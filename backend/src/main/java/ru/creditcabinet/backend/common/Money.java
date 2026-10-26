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

    /** «2 933 333,33» — как на сайте (русская локаль: неразрывный пробел между разрядами, запятая). */
    public static String format(BigDecimal value) {
        java.text.NumberFormat f = java.text.NumberFormat.getNumberInstance(java.util.Locale.forLanguageTag("ru-RU"));
        f.setMinimumFractionDigits(2);
        f.setMaximumFractionDigits(2);
        return f.format(value);
    }

    /** «20.10.2026». */
    public static String format(java.time.LocalDate date) {
        return date == null ? "—" : date.format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy"));
    }
}
