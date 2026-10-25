package ru.creditcabinet.backend.domain;

public enum DocumentType {
    FINANCIAL_SUMMARY("Финансовая сводка (наш шаблон, три полных месяца)"),
    TAX_DECLARATION("Налоговая декларация за последний отчётный год (УСН / ЕСХН / 3-НДФЛ или декларация по патенту) с отметкой о приёме"),
    ACCOUNTING_REPORTS("Бухгалтерская отчётность: баланс и отчёт о финансовых результатах за последний год"),
    TAX_DEBT_CERTIFICATE("Справка ФНС об отсутствии задолженности (не старше 30 дней)"),
    PURCHASE_DOCUMENT("Счёт, коммерческое предложение или договор со спецификацией на оборудование"),
    REPAIR_ESTIMATE("Смета или расчёт работ и материалов (либо договор подряда со сметой)"),
    PREMISES_RIGHTS("Документ на помещение: договор аренды или выписка о праве собственности");

    private final String title;
    DocumentType(String title) { this.title = title; }
    public String title() { return title; }
}
