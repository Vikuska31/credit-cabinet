"""Export the internal AI contract from its actual Pydantic/FastAPI models."""
import json
import copy
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "ai-service"))
from app.main import create_app  # noqa: E402
from app.config import Settings  # noqa: E402

target = root / "docs/openapi/ai-service.json"
target.parent.mkdir(parents=True, exist_ok=True)
internal = create_app(Settings(ai_enabled=False, _env_file=None)).openapi()
target.write_text(json.dumps(internal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(target.relative_to(root))

# Java's public facade deliberately exposes no raw model fields or candidate refs.
schemas = copy.deepcopy(internal["components"]["schemas"])
nullable_text = {"anyOf": [{"type": "string"}, {"type": "null"}]}
def ref(name):
    return {"$ref": "#/components/schemas/" + name}
def public_result(source, omit, extra):
    value = copy.deepcopy(schemas[source])
    for key in omit:
        value["properties"].pop(key, None)
    value["properties"].update(extra)
    value["required"] = list(value["properties"])
    value.pop("title", None)
    return value

schemas["GoalResponse"] = public_result("GoalResult", ["businessUse"], {"clarifyingQuestion": nullable_text})
schemas["FieldError"] = {"type": "object", "required": ["field", "message"], "properties": {"field": {"type": "string"}, "message": {"type": "string"}}}
schemas["Action"] = {"type": "object", "additionalProperties": False, "required": ["type", "label", "requiresConfirmation"], "properties": {
    "type": {"enum": ["START_SELECTION", "CONTINUE_DRAFT", "OPEN_APPLICATION", "SHOW_DOCUMENT", "EXPLAIN_TERMS"]}, "label": {"type": "string"}, "requiresConfirmation": {"const": True},
    "applicationId": nullable_text, "documentId": nullable_text, "topic": {"anyOf": [{"enum": ["RATE", "PAYMENT", "FEE", "DOCUMENTS", "PREVIEW"]}, {"type": "null"}]}}}
schemas["AssistantResponse"] = public_result("AssistantResult", ["businessUse", "targetRef", "evidence", "explanationTopic"], {
    "clarifyingQuestion": nullable_text, "reply": {"type": "string"}, "actions": {"type": "array", "items": ref("Action")}, "fieldErrors": {"type": "array", "items": ref("FieldError")}})
schemas["BrowserContext"] = {"type": "object", "additionalProperties": False, "required": ["screen"], "properties": {
    "screen": {"enum": ["HOME", "CREDITS", "WIZARD", "APPLICATIONS", "DOCUMENTS"]}, "applicationId": nullable_text, "documentId": nullable_text}}
schemas["PublicAssistantRequest"] = copy.deepcopy(schemas["AssistantRequest"])
schemas["PublicAssistantRequest"]["properties"]["context"] = ref("BrowserContext")
schemas["Capabilities"] = {"type": "object", "required": ["schemaVersion", "enabled", "features"], "properties": {
    "schemaVersion": {"const": "1"}, "enabled": {"type": "boolean"}, "features": {"type": "object", "required": ["goalClassification", "assistant"], "properties": {"goalClassification": {"type": "boolean"}, "assistant": {"type": "boolean"}}}}}
schemas["ApiError"] = {"type": "object", "required": ["code", "message", "fieldErrors"], "properties": {"code": {"type": "string"}, "message": {"type": "string"}, "fieldErrors": {"type": "array", "items": ref("FieldError")}}}
paths = {}
for path, method, request, response in [
    ("/api/ai/capabilities", "get", None, "Capabilities"),
    ("/api/ai/goals/classify", "post", "GoalRequest", "GoalResponse"),
    ("/api/ai/assistant", "post", "PublicAssistantRequest", "AssistantResponse"),
]:
    operation = {"security": [{"ClientSession": []}], "responses": {"200": {"description": "Validated analysis or UNAVAILABLE; never mutates an application", "content": {"application/json": {"schema": ref(response)}}}}}
    for code in ("400", "401", "403", "404"):
        operation["responses"][code] = {"description": "Input or access error", "content": {"application/json": {"schema": ref("ApiError")}}}
    if request:
        operation["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(request)}}}
    paths[path] = {method: operation}
public = {"openapi": "3.1.0", "info": {"title": "Credit Cabinet public AI facade (Java)", "version": "1.0.0", "description": "Client role only. Actions require an explicit user click. See docs/ai-integration.md for semantic invariants."}, "paths": paths,
          "components": {"securitySchemes": {"ClientSession": {"type": "http", "scheme": "bearer"}}, "schemas": schemas}}
public_target = target.with_name("backend-ai.json")
public_target.write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(public_target.relative_to(root))
