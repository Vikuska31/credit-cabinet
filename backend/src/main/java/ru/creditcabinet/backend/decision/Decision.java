package ru.creditcabinet.backend.decision;

import ru.creditcabinet.backend.domain.DocumentType;
import ru.creditcabinet.backend.tariff.LoanOffer;

import java.time.Instant;
import java.util.List;

/** Результат проверки заявки: исход, объяснимые причины и (при необходимости) предложение или запросы. */
public record Decision(
        Outcome outcome,
        List<Reason> reasons,
        List<ClarificationRequest> requests,
        LoanOffer offer,
        List<Change> changes,
        Instant decidedAt) {

    public enum Outcome { APPROVED, COUNTER_OFFER, NEEDS_INFO, REJECTED }

    public record Reason(String code, String text) {}

    /** Конкретный запрос: поле или документ плюс объяснение. */
    public record ClarificationRequest(String field, DocumentType documentType, String message) {}

    /** Различие между запросом клиента и предложением банка. */
    public record Change(String field, String requested, String offered) {}
}
