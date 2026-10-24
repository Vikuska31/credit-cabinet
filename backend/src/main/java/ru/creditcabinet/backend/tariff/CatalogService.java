package ru.creditcabinet.backend.tariff;

import ru.creditcabinet.backend.domain.LoanGoal;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Каталог раздела «Кредиты»: цели, подсказки и два предварительных расчёта. */
public class CatalogService {
    private final LoanCalculator calculator;

    public CatalogService(LoanCalculator calculator) { this.calculator = calculator; }

    public Tariff tariff() { return calculator.tariff(); }

    public List<LoanGoal> goals() { return List.of(LoanGoal.values()); }

    /** Подсказки выбранных целей без дублей и без подсказки для «Другое». */
    public List<String> hints(Set<LoanGoal> goals) {
        Set<String> hints = new LinkedHashSet<>();
        for (LoanGoal g : LoanGoal.values()) {
            if (goals.contains(g) && g != LoanGoal.OTHER) hints.add(g.hint());
        }
        return List.copyOf(hints);
    }

    public List<LoanOffer> preview(BigDecimal amount, Integer termMonths) {
        calculator.validate(amount, termMonths);
        return calculator.offers(amount, termMonths);
    }
}
