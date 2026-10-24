package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.tariff.LoanOffer;

import java.math.BigDecimal;
import java.util.Set;

/** Частичное обновление черновика: null означает «не менять». */
public record DraftUpdate(
        Set<LoanGoal> goals,
        String otherGoalText,
        LoanGoal otherGoalCategory,
        BigDecimal amount,
        Integer termMonths,
        LoanOffer.Kind selectedKind,
        BigDecimal monthlyIncomeRub,
        BigDecimal monthlyExpensesRub,
        Set<String> attachedDocumentIds,
        Boolean consent,
        Integer step) {

    public static DraftUpdate empty() {
        return new DraftUpdate(null, null, null, null, null, null, null, null, null, null, null);
    }
}
