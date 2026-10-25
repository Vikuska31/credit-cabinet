import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import JSONResponse

from .config import Settings
from .llm_client import LlmClient, Unavailable
from .schemas import AssistantRequest, GoalRequest, RawAssistant, RawGoal, AssistantResult, GoalResult
from .validation import check_assistant, check_goal

logger = logging.getLogger(__name__)


def log_unavailable(kind: str, error: Exception):
    reason = error.reason if isinstance(error, Unavailable) else "INVALID_RESPONSE"
    # Never log user text, model output, request bodies, URLs or credentials.
    logger.warning("AI request unavailable: task=%s reason=%s", kind, reason)


def create_app(settings: Settings | None = None, transport=None) -> FastAPI:
    cfg = settings or Settings()
    llm = LlmClient(cfg, transport)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await llm.client.aclose()

    app = FastAPI(title="Credit Cabinet AI", version="1.0.0", lifespan=lifespan)

    @app.middleware("http")
    async def size_limit(request: Request, call_next):
        if request.headers.get("content-length", "").isdigit() and int(request.headers["content-length"]) > 32768:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                return JSONResponse(status_code=413, content={"detail": "Request too large"})
        request._body = bytes(body)
        return await call_next(request)

    bearer = HTTPBearer(auto_error=False)

    def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        token = cfg.ai_service_token.get_secret_value()
        if not token or credentials is None or not hmac.compare_digest(credentials.credentials.encode(), token.encode()):
            raise HTTPException(status_code=401, detail="Service authentication required")

    @app.get("/health")
    def health():
        return {"status": "ok", "enabled": cfg.ai_enabled}

    @app.post("/v1/goals/classify", dependencies=[Depends(authorize)], response_model=GoalResult)
    async def classify(request: GoalRequest):
        try:
            source = request.text + "\n" + "\n".join(c.answer for c in request.clarifications)
            result = check_goal(await llm.complete("goals", request.model_dump(), RawGoal), source)
            return result.model_dump() | {"fallbackReason": None}
        except (Unavailable, ValueError) as exc:
            log_unavailable("goals", exc)
            return {"schemaVersion": "1", "status": "UNAVAILABLE", "businessUse": "NOT_APPLICABLE", "goals": [], "reasonCode": "AI_UNAVAILABLE", "questionCode": None, "evidence": [], "fallbackReason": exc.reason if isinstance(exc, Unavailable) else "INVALID_RESPONSE"}

    @app.post("/v1/assistant", dependencies=[Depends(authorize)], response_model=AssistantResult)
    async def assistant(request: AssistantRequest):
        try:
            # Assistant messages are not evidence of what the user actually requested.
            source = "\n".join([h.content for h in request.history if h.role == "user"] + [request.message])
            refs = {c.ref for c in request.context.applications + request.context.documents}
            result = check_assistant(await llm.complete("assistant", request.model_dump(), RawAssistant), source, refs)
            return result.model_dump() | {"fallbackReason": None}
        except (Unavailable, ValueError) as exc:
            log_unavailable("assistant", exc)
            return {"schemaVersion": "1", "status": "UNAVAILABLE", "businessUse": "NOT_APPLICABLE", "intent": "UNKNOWN", "entities": {"purposeText": None, "goals": [], "amount": None, "currency": None, "termMonths": None}, "questionCode": None, "explanationTopic": None, "targetRef": None, "evidence": [], "fallbackReason": exc.reason if isinstance(exc, Unavailable) else "INVALID_RESPONSE"}

    return app


app = create_app()
