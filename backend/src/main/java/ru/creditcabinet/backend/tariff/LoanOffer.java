package ru.creditcabinet.backend.tariff;

import java.math.BigDecimal;

/** Предварительный расчёт одной программы. Все числа считает приложение, не ИИ. */
public record LoanOffer(
        Kind kind,
        BigDecimal amount,
        int termMonths,
        BigDecimal annualRatePercent,
        BigDecimal monthlyPayment,
        BigDecimal totalInterest,
        BigDecimal upfrontFee,
        BigDecimal totalPayout) {

    public enum Kind {
        /** «По вашему запросу». */
        REQUESTED,
        /** «Меньше платёж в месяц». */
        LOWER_PAYMENT,
        /** Предложение банка, отличающееся от запроса. */
        BANK_COUNTER
    }

    public LoanOffer withKind(Kind newKind) {
        return new LoanOffer(newKind, amount, termMonths, annualRatePercent, monthlyPayment,
                totalInterest, upfrontFee, totalPayout);
    }
}
