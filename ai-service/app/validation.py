import re
from decimal import Decimal

from .schemas import RawAssistant, RawGoal

PERSONAL = re.compile(r"для\s+(?:себя|личного\s+пользования|личного\s+проживания)|на\s+(?:свой\s+)?отпуск|\b(?:свой|собственный|личный)\s+отпуск\b|погасить\s+личный\s+кредит", re.I)
WORDS = {"один": "1", "одна": "1", "два": "2", "две": "2", "три": "3", "четыре": "4", "пять": "5", "шесть": "6", "семь": "7", "восемь": "8", "девять": "9", "десять": "10", "двенадцать": "12", "полтора": "1.5", "полторы": "1.5", "двадцать четыре": "24"}


def source_quote(quote: str, source: str) -> str:
    """Recover original letter case only; never repair words, numbers or typos."""
    if quote in source:
        return quote
    match = re.search(re.escape(quote), source, re.I)
    if match is None or match.group().casefold() != quote.casefold():
        raise ValueError("invented evidence")
    return match.group()


def restore_quote_case(result, source: str):
    return result.model_copy(update={"evidence": [
        item.model_copy(update={"quote": source_quote(item.quote, source)})
        for item in result.evidence
    ]})


def numeric_value(quote: str, term: bool = False) -> Decimal | None:
    s = quote.lower().replace(",", ".").replace("\u202f", " ").replace("\u00a0", " ")
    for word, number in sorted(WORDS.items(), key=lambda x: -len(x[0])):
        s = re.sub(r"\b" + word + r"\b", number, s)
    values = re.findall(r"\d+(?:[ \u00a0]\d{3})*(?:\.\d+)?", s)
    if len(values) != 1:
        return None
    value = Decimal(values[0].replace(" ", "").replace("\u00a0", ""))
    if term:
        return value * 12 if re.search(r"год|года|лет", s) else value
    if re.search(r"млн|миллион", s):
        value *= 1_000_000
    elif re.search(r"тыс", s):
        value *= 1_000
    return value


def check_goal(result: RawGoal, source: str) -> RawGoal:
    result = restore_quote_case(result, source)
    if len(result.goals) != len(set(result.goals)):
        raise ValueError("duplicate goals")
    if result.status == "CLASSIFIED":
        if result.businessUse != "BUSINESS" or not result.goals or result.questionCode or PERSONAL.search(source):
            raise ValueError("unsafe classification")
        if {e.goal for e in result.evidence} != set(result.goals):
            raise ValueError("missing evidence")
    elif result.goals or result.evidence:
        raise ValueError("unconfirmed goals")
    if (result.status == "NEEDS_CLARIFICATION") != (result.questionCode is not None):
        raise ValueError("invalid clarification")
    if result.status == "NON_BUSINESS" and result.businessUse != "PERSONAL":
        raise ValueError("invalid personal purpose")
    if any(e.quote not in source for e in result.evidence):
        raise ValueError("invented evidence")
    return result


def check_assistant(result: RawAssistant, source: str, refs: set[str]) -> RawAssistant:
    result = restore_quote_case(result, source)
    e = result.entities
    if result.status == "READY" and result.businessUse in {"PERSONAL", "MIXED", "UNCLEAR"}:
        raise ValueError("unsafe purpose status")
    if result.status == "READY" and result.intent == "START_SELECTION" and PERSONAL.search(source):
        raise ValueError("personal purpose")
    if len(e.goals) != len(set(e.goals)) or any(x.quote not in source for x in result.evidence):
        raise ValueError("invalid evidence/goals")
    if result.targetRef is not None and result.targetRef not in refs:
        raise ValueError("unknown target")
    if (result.status == "NEEDS_CLARIFICATION") != (result.questionCode is not None):
        raise ValueError("invalid clarification")
    if (result.intent == "EXPLAIN_TERMS") != (result.explanationTopic is not None):
        raise ValueError("invalid explanation")
    if e.purposeText or e.goals:
        if result.businessUse != "BUSINESS" or PERSONAL.search(source):
            raise ValueError("unsafe purpose")
    if result.status in {"NON_BUSINESS", "UNSUPPORTED"} and (e.purposeText or e.goals or e.amount or e.termMonths):
        raise ValueError("unconfirmed entities")
    for field, value in (("amount", e.amount), ("termMonths", e.termMonths)):
        if value is not None:
            quotes = [x.quote for x in result.evidence if x.field == field]
            if not any(numeric_value(q, field == "termMonths") == Decimal(str(value)) for q in quotes):
                raise ValueError("unproven number")
    for field, present in (("purposeText", e.purposeText), ("goals", e.goals)):
        if present and not any(x.field == field for x in result.evidence):
            raise ValueError("missing evidence")
    if e.currency not in {None, "RUB"} and result.status != "NEEDS_CLARIFICATION":
        raise ValueError("foreign currency")
    return result
