package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.decision.Decision;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.tariff.LoanOffer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/** Что отдаём наружу. Сведения банковских проверок видит только сотрудник. */
public record ApplicationView(
        String id, long number, String companyInn, ApplicationStatus status, String statusTitle, int step,
        Set<LoanGoal> goals, String otherGoalText, LoanGoal otherGoalCategory,
        BigDecimal amount, Integer termMonths, LoanOffer.Kind selectedKind,
        BigDecimal monthlyIncomeRub, BigDecimal monthlyExpensesRub, Set<String> attachedDocumentIds, boolean consent,
        LoanOffer submittedOffer, Instant submittedAt, Decision decision, LoanOffer finalOffer, Instant issuedAt,
        List<Decision.ClarificationRequest> openRequests, List<HistoryEvent> history,
        BankData bankData) {

    static ApplicationView of(LoanApplication a, boolean forEmployee) {
        return new ApplicationView(a.id(), a.number(), a.companyInn(), a.status(), a.status().title(), a.step(),
                a.goals(), a.otherGoalText(), a.otherGoalCategory(), a.amount(), a.termMonths(), a.selectedKind(),
                a.monthlyIncomeRub(), a.monthlyExpensesRub(), Set.copyOf(a.attachedDocumentIds()), a.consent(),
                a.submittedOffer(), a.submittedAt(), a.decision(), a.finalOffer(), a.issuedAt(),
                a.openRequests(), a.history(), forEmployee ? a.bankDataSnapshot() : null);
    }
}
