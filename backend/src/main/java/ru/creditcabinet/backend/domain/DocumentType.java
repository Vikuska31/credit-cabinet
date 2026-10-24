package ru.creditcabinet.backend.domain;

public enum DocumentType {
    FINANCIAL_SUMMARY("Финансовая сводка"),
    PURCHASE_DOCUMENT("Счёт, коммерческое предложение или договор на оборудование"),
    REPAIR_ESTIMATE("Смета или расчёт работ и материалов");

    private final String title;
    DocumentType(String title) { this.title = title; }
    public String title() { return title; }
}
