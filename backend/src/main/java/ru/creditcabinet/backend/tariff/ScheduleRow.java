package ru.creditcabinet.backend.tariff;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ScheduleRow(int number, LocalDate date, BigDecimal payment, BigDecimal principal,
                          BigDecimal interest, BigDecimal balance) {}
