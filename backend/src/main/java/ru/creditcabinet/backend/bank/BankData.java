package ru.creditcabinet.backend.bank;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * Сведения из банковских источников. У каждого блока видны источник, дата и полнота.
 * Неизвестное значение = null, нулём не заменяем.
 */
public record BankData(Registry registry, CreditHistory creditHistory, Obligations obligations,
                       Overdue overdue, Inflows inflows) {

    public enum Completeness { FULL, PARTIAL, UNKNOWN }

    public record Meta(String source, LocalDate asOf, Completeness completeness) {}

    public record Registry(Meta meta, String status) {
        public boolean active() { return "active".equalsIgnoreCase(status); }
    }

    public record CreditHistory(Meta meta, Boolean exists, Integer closedLoansCount) {}

    public record Obligations(Meta meta, Integer activeLoansCount, BigDecimal monthlyPaymentsRub,
                              BigDecimal outstandingRub) {}

    public record Overdue(Meta meta, Boolean current, Integer currentDays, Integer pastCount, Integer maxDays) {}

    public record MonthInflow(YearMonth month, BigDecimal amountRub) {}

    public record Inflows(Meta meta, YearMonth periodFrom, YearMonth periodTo,
                          List<MonthInflow> byMonth, BigDecimal totalRub) {}
}
