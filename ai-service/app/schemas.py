from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

Goal = Literal["GOODS", "ADVERTISING", "EXPENSES", "EQUIPMENT", "REPAIR"]
Question = Literal["SPECIFY_BUSINESS_USE", "SPECIFY_PURPOSE", "SPECIFY_AMOUNT", "SPECIFY_TERM", "SPECIFY_CURRENCY", "EXCLUDE_PERSONAL_PURPOSE", "SELECT_APPLICATION", "SELECT_DOCUMENT"]
Intent = Literal["START_SELECTION", "CONTINUE_DRAFT", "OPEN_APPLICATION", "SHOW_DOCUMENT", "EXPLAIN_TERMS", "UNKNOWN", "OUT_OF_SCOPE"]
Topic = Literal["RATE", "PAYMENT", "FEE", "DOCUMENTS", "PREVIEW"]
BusinessUse = Literal["BUSINESS", "PERSONAL", "MIXED", "UNCLEAR", "NOT_APPLICABLE"]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Clarification(StrictModel):
    questionCode: Question
    answer: Text


class GoalRequest(StrictModel):
    text: Text
    clarifications: list[Clarification] = Field(default_factory=list, max_length=3)


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: Text


class Candidate(StrictModel):
    ref: str = Field(max_length=64)
    number: int | None = None
    status: str | None = Field(default=None, max_length=32)
    type: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=300)


class Context(StrictModel):
    screen: Literal["HOME", "CREDITS", "WIZARD", "APPLICATIONS", "DOCUMENTS"]
    applications: list[Candidate] = Field(default_factory=list, max_length=30)
    documents: list[Candidate] = Field(default_factory=list, max_length=30)


class AssistantRequest(StrictModel):
    message: Text
    context: Context
    history: list[HistoryMessage] = Field(default_factory=list, max_length=6)


class Evidence(StrictModel):
    field: Literal["purposeText", "goals", "amount", "termMonths"]
    quote: str = Field(min_length=1, max_length=500)


class GoalEvidence(StrictModel):
    goal: Goal
    quote: str = Field(min_length=1, max_length=500)


class Entities(StrictModel):
    purposeText: str | None = Field(max_length=1000)
    goals: list[Goal] = Field(max_length=5)
    amount: str | None = Field(pattern=r"^\d{1,12}(?:\.\d{1,2})?$")
    currency: Literal["RUB", "USD", "EUR", "OTHER"] | None
    termMonths: int | None = Field(ge=1, le=1200)


class RawGoal(StrictModel):
    schemaVersion: Literal["1"]
    businessUse: BusinessUse
    status: Literal["CLASSIFIED", "NEEDS_CLARIFICATION", "NON_BUSINESS", "UNSUPPORTED"]
    goals: list[Goal] = Field(max_length=5)
    reasonCode: Literal["BUSINESS_PURPOSE", "PERSONAL_PURPOSE", "AMBIGUOUS_PURPOSE", "OUTSIDE_TAXONOMY"]
    questionCode: Question | None
    evidence: list[GoalEvidence] = Field(max_length=5)


class RawAssistant(StrictModel):
    schemaVersion: Literal["1"]
    businessUse: BusinessUse
    intent: Intent
    status: Literal["READY", "NEEDS_CLARIFICATION", "NON_BUSINESS", "UNSUPPORTED"]
    entities: Entities
    questionCode: Question | None
    explanationTopic: Topic | None
    targetRef: str | None = Field(max_length=64)
    evidence: list[Evidence] = Field(max_length=10)


Fallback = Literal["DISABLED", "DEPENDENCY_UNAVAILABLE", "TIMEOUT", "INVALID_RESPONSE", "OVERLOADED"]


class GoalResult(RawGoal):
    status: Literal["CLASSIFIED", "NEEDS_CLARIFICATION", "NON_BUSINESS", "UNSUPPORTED", "UNAVAILABLE"]
    reasonCode: Literal["BUSINESS_PURPOSE", "PERSONAL_PURPOSE", "AMBIGUOUS_PURPOSE", "OUTSIDE_TAXONOMY", "AI_UNAVAILABLE"]
    fallbackReason: Fallback | None


class AssistantResult(RawAssistant):
    status: Literal["READY", "NEEDS_CLARIFICATION", "NON_BUSINESS", "UNSUPPORTED", "UNAVAILABLE"]
    fallbackReason: Fallback | None
