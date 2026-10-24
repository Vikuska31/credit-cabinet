package ru.creditcabinet.backend.decision;

import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.bank.BankData.Completeness;
import ru.creditcabinet.backend.decision.Decision.Change;
import ru.creditcabinet.backend.decision.Decision.ClarificationRequest;
import ru.creditcabinet.backend.decision.Decision.Outcome;
import ru.creditcabinet.backend.decision.Decision.Reason;
import ru.creditcabinet.backend.domain.Company;
import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentType;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.tariff.LoanCalculator;
import ru.creditcabinet.backend.tariff.LoanOffer;
import ru.creditcabinet.backend.tariff.Tariff;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.Period;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Решение по явным объяснимым правилам. Результат определяется данными и параметрами заявки,
 * а не названием демопрофиля. ИИ в решении не участвует.
 *
 * Порядок: 1) жёсткие отказы, 2) недостающие сведения и документы, 3) долговая нагрузка
 * (одобрение, встречное предложение или отказ).
 */
public class DecisionEngine {
    private final LoanCalculator calculator;
    private final Clock clock;

    public DecisionEngine(LoanCalculator calculator, Clock clock) {
        this.calculator = calculator;
        this.clock = clock;
    }

    public record Input(Company company, Set<LoanGoal> goals, LoanOffer selectedOffer,
                        BankData bankData, List<DocumentRef> documents) {}

    public Decision decide(Input in) {
        Tariff t = calculator.tariff();
        LocalDate today = LocalDate.now(clock);
        BankData d = in.bankData();

        // 1. Жёсткие отказы
        List<Reason> rejects = new ArrayList<>();
        if (d.registry() != null && !d.registry().active()) {
            rejects.add(new Reason("business_inactive", "Бизнес не числится действующим в реестре"));
        }
        long ageMonths = Period.between(in.company().registeredAt(), today).toTotalMonths();
        if (ageMonths < t.minBusinessAgeMonths()) {
            rejects.add(new Reason("business_too_young",
                    "Бизнес зарегистрирован меньше %d мес. назад".formatted(t.minBusinessAgeMonths())));
        }
        BankData.Overdue od = d.overdue();
        if (od != null) {
            if (Boolean.TRUE.equals(od.current())) {
                rejects.add(new Reason("current_overdue", "Есть текущая просрочка по кредиту (%s дн., источник: %s на %s)"
                        .formatted(od.currentDays() == null ? "срок неизвестен" : od.currentDays(),
                                od.meta().source(), od.meta().asOf())));
            }
            if (od.maxDays() != null && od.maxDays() > t.maxPastOverdueDays()) {
                rejects.add(new Reason("past_overdue",
                        "В прошлом была просрочка %d дн. при допустимых %d".formatted(od.maxDays(), t.maxPastOverdueDays())));
            }
        }
        if (!rejects.isEmpty()) {
            return result(Outcome.REJECTED, rejects, List.of(), null, List.of());
        }

        // 2. Недостающие сведения и документы
        List<ClarificationRequest> requests = new ArrayList<>();
        YearMonth last = YearMonth.from(today).minusMonths(1);
        YearMonth first = last.minusMonths(2);
        boolean hasSummary = in.documents().stream().anyMatch(doc ->
                doc.type() == DocumentType.FINANCIAL_SUMMARY && doc.covers(first, last));
        if (!hasSummary) {
            requests.add(new ClarificationRequest("financial_summary", DocumentType.FINANCIAL_SUMMARY,
                    "Нужна финансовая сводка за %s – %s: доходы и операционные расходы по месяцам. Поступления на счёт не равны прибыли."
                            .formatted(first, last)));
        }
        for (LoanGoal goal : in.goals()) {
            goal.requiredDocument().ifPresent(type -> {
                boolean has = in.documents().stream().anyMatch(doc -> doc.type() == type);
                if (!has) {
                    requests.add(new ClarificationRequest("document_" + type.name().toLowerCase(), type,
                            "Для цели «%s» нужен документ: %s".formatted(goal.title(), type.title())));
                }
            });
        }
        BankData.Inflows inflows = d.inflows();
        if (inflows == null || inflows.meta().completeness() != Completeness.FULL || inflows.totalRub() == null) {
            requests.add(new ClarificationRequest("account_statement", null,
                    "Сведений о поступлениях по известным счетам недостаточно: приложите выписку по другому счёту за последние три месяца."));
        }
        if (!requests.isEmpty()) {
            return result(Outcome.NEEDS_INFO,
                    List.of(new Reason("missing_information", "Для решения не хватает сведений. Это не отказ.")),
                    requests, null, List.of());
        }

        // 3. Долговая нагрузка
        BigDecimal avgInflow = inflows.totalRub().divide(BigDecimal.valueOf(inflows.byMonth().size()), 2, RoundingMode.HALF_UP);
        BigDecimal existing = d.obligations() != null && d.obligations().monthlyPaymentsRub() != null
                ? d.obligations().monthlyPaymentsRub() : BigDecimal.ZERO;
        BigDecimal limit = avgInflow.multiply(t.maxDebtLoadRatio());
        LoanOffer selected = in.selectedOffer();

        if (existing.add(selected.monthlyPayment()).compareTo(limit) <= 0) {
            Reason ok = new Reason("approved", "Долговая нагрузка %s при допустимых %s. Среднемесячные поступления %s ₽, действующие платежи %s ₽ (источник: %s на %s)."
                    .formatted(percent(existing.add(selected.monthlyPayment()), avgInflow), percent(t.maxDebtLoadRatio().multiply(avgInflow), avgInflow),
                            avgInflow, existing, inflows.meta().source(), inflows.meta().asOf()));
            return result(Outcome.APPROVED, List.of(ok), List.of(), selected, List.of());
        }

        BigDecimal room = limit.subtract(existing);
        Reason overload = new Reason("debt_load_high",
                "Долговая нагрузка с новым платежом %s ₽ составила бы %s при допустимых %s"
                        .formatted(selected.monthlyPayment(), percent(existing.add(selected.monthlyPayment()), avgInflow),
                                percent(limit, avgInflow)));

        // 3а. Тот же размер на более длинный срок
        for (int term = selected.termMonths() + 1; term <= calculator.tariff().maxTermMonths(); term++) {
            LoanOffer longer = calculator.offer(LoanOffer.Kind.BANK_COUNTER, selected.amount(), term);
            if (existing.add(longer.monthlyPayment()).compareTo(limit) <= 0) {
                return result(Outcome.COUNTER_OFFER, List.of(overload), List.of(), longer, changes(selected, longer));
            }
        }
        // 3б. Меньшая сумма на максимальный срок
        if (room.signum() > 0) {
            int maxTerm = calculator.tariff().maxTermMonths();
            BigDecimal amount = calculator.maxAmountForPayment(room, maxTerm)
                    .min(selected.amount()).setScale(0, RoundingMode.DOWN);
            amount = amount.subtract(amount.remainder(BigDecimal.valueOf(1000)));
            if (amount.compareTo(calculator.tariff().minAmount()) >= 0) {
                LoanOffer smaller = calculator.offer(LoanOffer.Kind.BANK_COUNTER, amount, maxTerm);
                if (existing.add(smaller.monthlyPayment()).compareTo(limit) <= 0) {
                    return result(Outcome.COUNTER_OFFER, List.of(overload), List.of(), smaller, changes(selected, smaller));
                }
            }
        }
        return result(Outcome.REJECTED,
                List.of(overload, new Reason("no_affordable_offer", "Даже при максимальном сроке подходящих условий в рамках программы нет")),
                List.of(), null, List.of());
    }

    private static List<Change> changes(LoanOffer from, LoanOffer to) {
        List<Change> list = new ArrayList<>();
        if (from.amount().compareTo(to.amount()) != 0) list.add(new Change("amount", from.amount().toPlainString(), to.amount().toPlainString()));
        if (from.termMonths() != to.termMonths()) list.add(new Change("termMonths", String.valueOf(from.termMonths()), String.valueOf(to.termMonths())));
        if (from.annualRatePercent().compareTo(to.annualRatePercent()) != 0) list.add(new Change("annualRatePercent", from.annualRatePercent().toPlainString(), to.annualRatePercent().toPlainString()));
        if (from.monthlyPayment().compareTo(to.monthlyPayment()) != 0) list.add(new Change("monthlyPayment", from.monthlyPayment().toPlainString(), to.monthlyPayment().toPlainString()));
        return list;
    }

    private static String percent(BigDecimal part, BigDecimal whole) {
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 1, RoundingMode.HALF_UP) + "%";
    }

    private Decision result(Outcome outcome, List<Reason> reasons, List<ClarificationRequest> requests,
                            LoanOffer offer, List<Change> changes) {
        return new Decision(outcome, reasons, requests, offer, changes, clock.instant());
    }
}
