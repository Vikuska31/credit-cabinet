package ru.creditcabinet.backend.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Какие документы нужны клиенту. Набор собран по типичной российской банковской практике
 * для кредита без залога, но НЕ является политикой Альфа-Банка (организаторы пакет не задали).
 *
 * Уровни:
 * 1) экспресс (сумма до порога тарифа): финансовая сводка + документы под цель;
 * 2) полный пакет (сумма выше порога): добавляется налоговая и бухгалтерская отчётность и справка ФНС.
 *
 * Паспорт руководителя, ИНН, выписка ЕГРЮЛ/ЕГРИП, устав и решение о назначении руководителя
 * у действующего клиента уже есть в карточке банка ({@link #ON_FILE}), повторно их не запрашиваем.
 * Для целей «Товары», «Реклама», «Текущие расходы» отдельных документов не требуется.
 */
public final class DocumentRequirements {
    private DocumentRequirements() {}

    /** Уже хранится в карточке клиента банка. Показываем как информацию, не запрашиваем. */
    public static final List<String> ON_FILE = List.of(
            "Паспорт руководителя (предпринимателя)", "ИНН и выписка ЕГРЮЛ/ЕГРИП",
            "Устав и решение о назначении руководителя (для ООО)", "Сведения о бенефициарах (для ООО)");

    public record Requirement(DocumentType type, boolean blocksSubmit, String reason, Predicate<DocumentRef> suitable) {}

    public static List<Requirement> forApplication(CompanyForm form, Set<LoanGoal> goals, BigDecimal amount,
                                                   BigDecimal fullPackageThreshold, LocalDate today) {
        List<Requirement> list = new ArrayList<>();
        YearMonth lastMonth = YearMonth.from(today).minusMonths(1);
        list.add(new Requirement(DocumentType.FINANCIAL_SUMMARY, false,
                "Доходы и операционные расходы по месяцам за %s – %s. Поступления на счёт не равны прибыли.".formatted(lastMonth.minusMonths(2), lastMonth),
                d -> d.covers(lastMonth.minusMonths(2), lastMonth)));

        if (amount != null && amount.compareTo(fullPackageThreshold) > 0) {
            YearMonth lastYearEnd = YearMonth.of(Year.from(today).getValue() - 1, 12);
            String over = "Сумма выше %s ₽: для неё нужен полный пакет.".formatted(fullPackageThreshold.toBigInteger());
            list.add(new Requirement(DocumentType.TAX_DECLARATION, false, over, d -> d.covers(lastYearEnd, lastYearEnd)));
            if (form == CompanyForm.OOO) {
                list.add(new Requirement(DocumentType.ACCOUNTING_REPORTS, false, over, d -> d.covers(lastYearEnd, lastYearEnd)));
            }
            list.add(new Requirement(DocumentType.TAX_DEBT_CERTIFICATE, false, over,
                    d -> d.uploadedAt() != null && d.uploadedAt().isAfter(today.minusDays(30).atStartOfDay().toInstant(java.time.ZoneOffset.UTC))));
        }

        for (LoanGoal goal : goals) {
            goal.requiredDocument().ifPresent(type ->
                    list.add(new Requirement(type, true, "Цель «%s»".formatted(goal.title()), d -> true)));
        }
        if (goals.contains(LoanGoal.REPAIR)) {
            list.add(new Requirement(DocumentType.PREMISES_RIGHTS, true,
                    "Цель «Ремонт и обустройство»: нужно подтвердить право пользоваться помещением", d -> true));
        }
        return list;
    }
}
