import asyncio
from copy import deepcopy
import json
from pathlib import Path
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel

from .config import Settings


class Unavailable(Exception):
    def __init__(self, reason: str):
        self.reason = reason


def goal_decoding_schema(base: dict) -> dict:
    """Enforce cross-field rules during decoding as well as after generation."""
    variants = []
    for status, business, reason in (
        ("CLASSIFIED", ["BUSINESS"], "BUSINESS_PURPOSE"),
        ("NEEDS_CLARIFICATION", ["BUSINESS", "MIXED", "UNCLEAR"], "AMBIGUOUS_PURPOSE"),
        ("NON_BUSINESS", ["PERSONAL"], "PERSONAL_PURPOSE"),
        ("UNSUPPORTED", ["BUSINESS"], "OUTSIDE_TAXONOMY"),
    ):
        branch = deepcopy(base)
        branch.pop("$defs", None)
        properties = branch["properties"]
        properties["status"] = {"type": "string", "const": status}
        properties["businessUse"] = {"type": "string", "enum": business}
        properties["reasonCode"] = {"type": "string", "const": reason}
        if status == "NEEDS_CLARIFICATION":
            properties["questionCode"] = next(p for p in properties["questionCode"]["anyOf"] if p.get("type") == "string")
        else:
            properties["questionCode"] = {"type": "null"}
        for field in ("goals", "evidence"):
            if status == "CLASSIFIED":
                properties[field]["minItems"] = 1
            else:
                properties[field]["maxItems"] = 0
        variants.append(branch)
    return {"$defs": base.get("$defs", {}), "anyOf": variants}


def assistant_decoding_schema(base: dict) -> dict:
    variants = []
    for status in ("READY", "NEEDS_CLARIFICATION", "NON_BUSINESS", "UNSUPPORTED"):
        branch = deepcopy(base)
        branch.pop("$defs", None)
        properties = branch["properties"]
        properties["status"] = {"type": "string", "const": status}
        if status == "NEEDS_CLARIFICATION":
            properties["questionCode"] = next(p for p in properties["questionCode"]["anyOf"] if p.get("type") == "string")
        else:
            properties["questionCode"] = {"type": "null"}
        if status == "READY":
            properties["businessUse"] = {"type": "string", "enum": ["BUSINESS", "NOT_APPLICABLE"]}
        if status in {"NON_BUSINESS", "UNSUPPORTED"}:
            entities = deepcopy(base["$defs"]["Entities"])
            for name in entities["properties"]:
                entities["properties"][name] = {"type": "array", "items": entities["properties"][name]["items"], "maxItems": 0} if name == "goals" else {"type": "null"}
            properties["entities"] = entities
            properties["evidence"]["maxItems"] = 0
            properties["intent"] = {"type": "string", "enum": ["UNKNOWN", "OUT_OF_SCOPE"]}
            properties["targetRef"] = properties["explanationTopic"] = {"type": "null"}
        if status == "NON_BUSINESS":
            properties["businessUse"] = {"type": "string", "const": "PERSONAL"}
        variants.append(branch)
    return {"$defs": base.get("$defs", {}), "anyOf": variants}


class LlmClient:
    def __init__(self, settings: Settings, transport=None):
        self.settings = settings
        self.client = httpx.AsyncClient(timeout=settings.llm_request_timeout_ms / 1000, transport=transport, follow_redirects=False, trust_env=False)
        self.slots = asyncio.Semaphore(settings.ai_max_concurrent_requests)
        self.admissions = asyncio.Semaphore(settings.ai_max_concurrent_requests + settings.ai_max_queued_requests)

    async def complete(self, kind: str, payload: dict, schema: type[BaseModel]):
        cfg = self.settings
        if not cfg.ai_enabled:
            raise Unavailable("DISABLED")
        if self.admissions.locked():
            raise Unavailable("OVERLOADED")
        if urlparse(cfg.llm_base_url).scheme not in {"http", "https"}:
            raise Unavailable("DEPENDENCY_UNAVAILABLE")
        prompt = (Path(__file__).parent / "prompts" / f"{kind}.txt").read_text(encoding="utf-8")
        # Constrained decoding needs a schema; the model also needs to see its fields.
        output_schema = schema.model_json_schema()
        prompt += "\nOutput JSON Schema:\n" + json.dumps(output_schema, ensure_ascii=False, separators=(",", ":"))
        decoding_schema = goal_decoding_schema(output_schema) if kind == "goals" else assistant_decoding_schema(output_schema)
        body = {"model": cfg.llm_model_name, "stream": False, "temperature": 0,
                "max_tokens": cfg.llm_max_output_tokens,
                "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                "response_format": {"type": "json_schema", "json_schema": {"name": kind, "strict": True, "schema": decoding_schema}}}
        if cfg.llm_provider == "vllm":
            body["chat_template_kwargs"] = {"enable_thinking": False}
        elif cfg.llm_provider == "ollama":
            body["reasoning_effort"] = "none"
        headers = {"Authorization": f"Bearer {cfg.llm_api_token.get_secret_value()}"} if cfg.llm_api_token.get_secret_value() else {}
        async with self.admissions:
            try:
                async with asyncio.timeout(cfg.llm_request_timeout_ms / 1000):
                    # Waiting and generation share one timeout. The bounded queue
                    # lets the two UI features coexist on a single CPU worker.
                    async with self.slots:
                        async with self.client.stream("POST", cfg.llm_base_url.rstrip("/") + "/chat/completions", json=body, headers=headers) as response:
                            response.raise_for_status()
                            data = bytearray()
                            async for chunk in response.aiter_bytes():
                                data.extend(chunk)
                                if len(data) > 65536:
                                    raise Unavailable("INVALID_RESPONSE")
                raw = json.loads(data)
                choice = raw["choices"][0]
                if choice.get("finish_reason") != "stop" or choice["message"].get("tool_calls"):
                    raise Unavailable("INVALID_RESPONSE")
                return schema.model_validate_json(choice["message"]["content"])
            except (TimeoutError, httpx.TimeoutException) as exc:
                raise Unavailable("TIMEOUT") from exc
            except httpx.HTTPError as exc:
                raise Unavailable("DEPENDENCY_UNAVAILABLE") from exc
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                raise Unavailable("INVALID_RESPONSE") from exc
