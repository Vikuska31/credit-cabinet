package ru.creditcabinet.backend.application;

import java.util.EnumSet;
import java.util.Set;

/** Состояния заявки и допустимые переходы (см. docs/state-diagram.md). */
public enum ApplicationStatus {
    DRAFT("Черновик"),
    UNDER_REVIEW("На рассмотрении"),
    NEEDS_CLARIFICATION("Нужно уточнение"),
    CHECK_FAILED("Проверка не завершена"),
    APPROVED("Одобрено, ждёт принятия условий"),
    COUNTER_OFFERED("Предложены другие условия"),
    REJECTED("Отказ"),
    DECLINED_BY_CLIENT("Клиент отказался от предложения"),
    ISSUED("Кредит оформлен — демо");

    private final String title;
    ApplicationStatus(String title) { this.title = title; }
    public String title() { return title; }

    public Set<ApplicationStatus> next() {
        return switch (this) {
            case DRAFT -> EnumSet.of(UNDER_REVIEW);
            case UNDER_REVIEW -> EnumSet.of(NEEDS_CLARIFICATION, CHECK_FAILED, APPROVED, COUNTER_OFFERED, REJECTED);
            case NEEDS_CLARIFICATION -> EnumSet.of(UNDER_REVIEW);
            case CHECK_FAILED -> EnumSet.of(UNDER_REVIEW);
            case APPROVED -> EnumSet.of(ISSUED, DECLINED_BY_CLIENT, NEEDS_CLARIFICATION);
            case COUNTER_OFFERED -> EnumSet.of(ISSUED, DECLINED_BY_CLIENT, NEEDS_CLARIFICATION);
            case REJECTED, DECLINED_BY_CLIENT, ISSUED -> EnumSet.noneOf(ApplicationStatus.class);
        };
    }

    public boolean isFinal() { return next().isEmpty(); }
}
