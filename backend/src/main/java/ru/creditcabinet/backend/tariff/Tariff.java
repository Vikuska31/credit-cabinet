package ru.creditcabinet.backend.tariff;

import java.math.BigDecimal;

/**
 * Синтетический тариф программы «Кредит для бизнеса». Числа ПРЕДЛОЖЕНЫ мной и ждут утверждения Феди;
 * они не копируют реальные тарифы банка.
 */
public record Tariff(
        BigDecimal minAmount,
        BigDecimal maxAmount,
        int minTermMonths,
        int maxTermMonths,
        int longerTermStepMonths,
        BigDecimal annualRatePercent,
        BigDecimal upfrontFeePercent,
        BigDecimal maxDebtLoadRatio,
        int minBusinessAgeMonths,
        int maxPastOverdueDays) {

    public static final Tariff DEMO = new Tariff(
            new BigDecimal("100000"), new BigDecimal("10000000"),
            6, 60, 12,
            new BigDecimal("21.0"), new BigDecimal("1.0"),
            new BigDecimal("0.35"), 6, 30);
}
