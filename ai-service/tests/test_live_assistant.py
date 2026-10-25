"""Real Qwen evaluation; synthetic context only, no credit mutations."""
import asyncio
import os
from decimal import Decimal

import pytest

from app.config import Settings
from app.llm_client import LlmClient
from app.schemas import RawAssistant
from app.validation import check_assistant

CASES = [
    pytest.param("Покупка станков для мастерскойв", "READY", "START_SELECTION", {"EQUIPMENT"}, None, None, None, id="purpose-with-typo-without-command"),
    pytest.param("Подбери кредит: 900 тысяч рублей на оборудование моей пекарни на 18 месяцев",
                 "READY", "START_SELECTION", {"EQUIPMENT"}, "900000", 18, None, id="selection-slots"),
    pytest.param("Продолжить мой черновик", "READY", "CONTINUE_DRAFT", set(), None, None, None, id="continue-draft"),
    pytest.param("Открой мою заявку номер 17", "READY", "OPEN_APPLICATION", set(), None, None, None, id="open-application"),
    pytest.param("Покажи документ Счёт за оборудование", "READY", "SHOW_DOCUMENT", set(), None, None, None, id="show-document"),
    pytest.param("Объясни комиссию по кредиту", "READY", "EXPLAIN_TERMS", set(), None, None, "FEE", id="explain-terms"),
    pytest.param("Нужен кредит на мой личный отпуск", "NON_BUSINESS", None, set(), None, None, None, id="personal-purpose"),
    pytest.param("Подбери кредит, чтобы купить машину", "NEEDS_CLARIFICATION", "START_SELECTION", set(), None, None, None, id="ambiguous-purpose"),
]


@pytest.mark.skipif(os.getenv("RUN_QWEN_EVAL") != "1", reason="Set RUN_QWEN_EVAL=1 and configure a real Qwen endpoint")
@pytest.mark.parametrize("message,status,intent,goals,amount,term,topic", CASES)
def test_real_assistant(message, status, intent, goals, amount, term, topic):
    async def run():
        client = LlmClient(Settings(ai_enabled=True))
        try:
            raw = await client.complete("assistant", {
                "message": message, "history": [],
                "context": {"screen": "HOME",
                            "applications": [{"ref": "app-0", "number": 17, "status": "DRAFT"}],
                            "documents": [{"ref": "doc-0", "type": "PURCHASE_DOCUMENT", "title": "Счёт за оборудование"}]},
            }, RawAssistant)
            try:
                return check_assistant(raw, message, {"app-0", "doc-0"})
            except ValueError as exc:
                pytest.fail(f"{exc}; model response: {raw.model_dump_json()}")
        finally:
            await client.client.aclose()

    result = asyncio.run(run())
    assert result.status == status
    if intent is not None:
        assert result.intent == intent
    assert set(result.entities.goals) == goals
    assert (Decimal(result.entities.amount) if result.entities.amount is not None else None) == (Decimal(amount) if amount else None)
    assert result.entities.termMonths == term
    assert result.explanationTopic == topic
    if intent in {"CONTINUE_DRAFT", "OPEN_APPLICATION"}:
        assert result.targetRef == "app-0"
    if intent == "SHOW_DOCUMENT":
        assert result.targetRef == "doc-0"
