package ru.creditcabinet.backend.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Все рубли храним как BigDecimal с двумя знаками. */
public final class Money {
    private Money() {}

    public static BigDecimal rub(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal rub(long value) {
        return rub(BigDecimal.valueOf(value));
    }

    public static BigDecimal rub(String value) {
        return rub(new BigDecimal(value));
    }
}
