package ru.creditcabinet.backend.domain;

import java.util.Optional;

/** Цели кредита из раздела 3 документа. Подсказки заданы заранее, ИИ для них не нужен. */
public enum LoanGoal {
    GOODS("Товары и сырьё", "Учтите доставку", null),
    ADVERTISING("Реклама и продвижение", "Учтите бюджет размещения", null),
    EXPENSES("Текущие расходы", "Учтите регулярные платежи", null),
    EQUIPMENT("Оборудование", "Подготовьте счёт или предложение поставщика", DocumentType.PURCHASE_DOCUMENT),
    REPAIR("Ремонт и обустройство", "Подготовьте смету работ и материалов", DocumentType.REPAIR_ESTIMATE),
    OTHER("Другое", "Опишите свою бизнес-задачу", null);

    private final String title;
    private final String hint;
    private final DocumentType requiredDocument;

    LoanGoal(String title, String hint, DocumentType requiredDocument) {
        this.title = title;
        this.hint = hint;
        this.requiredDocument = requiredDocument;
    }

    public String title() { return title; }
    public String hint() { return hint; }
    public Optional<DocumentType> requiredDocument() { return Optional.ofNullable(requiredDocument); }
}
