"""Opt-in semantic evaluation. Never substitutes a stub for real Qwen."""
import asyncio
import os

import pytest

from app.config import Settings
from app.llm_client import LlmClient
from app.schemas import RawGoal
from app.validation import check_goal

CASES = [
    ("Закупить муку для моей пекарни", "CLASSIFIED", {"GOODS"}),
    ("Оплатить рекламу моей кофейни", "CLASSIFIED", {"ADVERTISING"}),
    ("Оплатить аренду и зарплаты сотрудников магазина", "CLASSIFIED", {"EXPENSES"}),
    ("Купить станок для своей мастерской", "CLASSIFIED", {"EQUIPMENT"}),
    ("Ремонт торгового зала нашего магазина", "CLASSIFIED", {"REPAIR"}),
    ("Закупить сырьё и рекламу для пекарни", "CLASSIFIED", {"GOODS", "ADVERTISING"}),
    ("Купить оборудование и сделать ремонт в моей кофейне", "CLASSIFIED", {"EQUIPMENT", "REPAIR"}),
    ("Купить машину", "NEEDS_CLARIFICATION", set()),
    ("Нужно на развитие", "NEEDS_CLARIFICATION", set()),
    ("Ремонт квартиры для личного проживания", "NON_BUSINESS", set()),
    ("Хочу на свой отпуск", "NON_BUSINESS", set()),
    ("Погасить личный кредит", "NON_BUSINESS", set()),
    ("Закупить муку для пекарни и оплатить свой отпуск", "NEEDS_CLARIFICATION", set()),
    ("Купить станок и запустить рекламу мастерской", "CLASSIFIED", {"EQUIPMENT", "ADVERTISING"}),
    ("Покупка станков для мастерской", "CLASSIFIED", {"EQUIPMENT"}),
    ("Покупка станков для мастерскойв", "CLASSIFIED", {"EQUIPMENT"}),
]


@pytest.mark.skipif(os.getenv("RUN_QWEN_EVAL") != "1", reason="Set RUN_QWEN_EVAL=1 and configure a real Qwen endpoint")
@pytest.mark.parametrize("text,status,goals", CASES)
def test_real_qwen(text, status, goals):
    async def run():
        client = LlmClient(Settings(ai_enabled=True))
        try:
            raw = await client.complete("goals", {"text": text, "clarifications": []}, RawGoal)
            try:
                return check_goal(raw, text)
            except ValueError as exc:
                pytest.fail(f"{exc}; model response: {raw.model_dump_json()}")
        finally:
            await client.client.aclose()
    result = asyncio.run(run())
    assert result.status == status
    assert set(result.goals) == goals
