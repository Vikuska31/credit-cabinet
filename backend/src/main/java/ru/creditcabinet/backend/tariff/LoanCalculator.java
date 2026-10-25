package ru.creditcabinet.backend.tariff;

import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.common.ApiException.FieldError;
import ru.creditcabinet.backend.common.Money;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Аннуитетный расчёт по тарифу: платёж, проценты, общая выплата и график. */
public class LoanCalculator {
    private static final MathContext MC = new MathContext(30, RoundingMode.HALF_UP);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWELVE = BigDecimal.valueOf(12);

    private final Tariff tariff;

    public LoanCalculator(Tariff tariff) {
        this.tariff = tariff;
    }

    public Tariff tariff() { return tariff; }

    /** Проверяет диапазоны тарифа. Ошибки привязаны к полям, введённое клиентом не теряется. */
    public void validate(BigDecimal amount, Integer termMonths) {
        List<FieldError> errors = new ArrayList<>();
        if (amount == null) {
            errors.add(new FieldError("amount", "Укажите сумму"));
        } else if (amount.compareTo(tariff.minAmount()) < 0 || amount.compareTo(tariff.maxAmount()) > 0) {
            errors.add(new FieldError("amount", "Сумма должна быть от %s до %s ₽"
                    .formatted(tariff.minAmount().toBigInteger(), tariff.maxAmount().toBigInteger())));
        }
        if (termMonths == null) {
            errors.add(new FieldError("termMonths", "Укажите срок"));
        } else if (termMonths < tariff.minTermMonths() || termMonths > tariff.maxTermMonths()) {
            errors.add(new FieldError("termMonths", "Срок должен быть от %d до %d мес."
                    .formatted(tariff.minTermMonths(), tariff.maxTermMonths())));
        }
        if (!errors.isEmpty()) throw ApiException.validation(errors);
    }

    public LoanOffer offer(LoanOffer.Kind kind, BigDecimal amount, int termMonths) {
        BigDecimal amt = Money.rub(amount);
        BigDecimal payment = monthlyPayment(amt, termMonths);
        List<ScheduleRow> rows = schedule(amt, termMonths, LocalDate.of(2000, 1, 1));
        BigDecimal interest = rows.stream().map(ScheduleRow::interest).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal fee = Money.rub(amt.multiply(tariff.upfrontFeePercent()).divide(HUNDRED, MC));
        BigDecimal paid = rows.stream().map(ScheduleRow::payment).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new LoanOffer(kind, amt, termMonths, tariff.annualRatePercent(), payment,
                Money.rub(interest), fee, Money.rub(paid.add(fee)));
    }

    /** Два расчёта одной программы; второго нет, если срок уже максимальный. */
    public List<LoanOffer> offers(BigDecimal amount, int termMonths) {
        validate(amount, termMonths);
        List<LoanOffer> result = new ArrayList<>();
        result.add(offer(LoanOffer.Kind.REQUESTED, amount, termMonths));
        if (termMonths < tariff.maxTermMonths()) {
            int longer = Math.min(termMonths + tariff.longerTermStepMonths(), tariff.maxTermMonths());
            result.add(offer(LoanOffer.Kind.LOWER_PAYMENT, amount, longer));
        }
        return result;
    }

    public BigDecimal monthlyPayment(BigDecimal amount, int termMonths) {
        BigDecimal r = monthlyRate();
        if (r.signum() == 0) {
            return Money.rub(amount.divide(BigDecimal.valueOf(termMonths), MC));
        }
        BigDecimal pow = BigDecimal.ONE.add(r).pow(termMonths, MC);
        BigDecimal k = r.multiply(pow, MC).divide(pow.subtract(BigDecimal.ONE), MC);
        return Money.rub(amount.multiply(k, MC));
    }

    /** Наибольшая сумма, платёж по которой не превышает {@code maxPayment}, при данном сроке. */
    public BigDecimal maxAmountForPayment(BigDecimal maxPayment, int termMonths) {
        BigDecimal unit = monthlyPayment(BigDecimal.valueOf(100_000), termMonths);
        return maxPayment.multiply(BigDecimal.valueOf(100_000)).divide(unit, 0, RoundingMode.DOWN);
    }

    public List<ScheduleRow> schedule(BigDecimal amount, int termMonths, LocalDate firstPaymentDate) {
        BigDecimal r = monthlyRate();
        BigDecimal payment = monthlyPayment(amount, termMonths);
        BigDecimal balance = Money.rub(amount);
        List<ScheduleRow> rows = new ArrayList<>();
        for (int i = 1; i <= termMonths; i++) {
            BigDecimal interest = Money.rub(balance.multiply(r, MC));
            BigDecimal principal;
            BigDecimal pay;
            if (i == termMonths) {
                principal = balance;
                pay = principal.add(interest);
            } else {
                pay = payment;
                principal = pay.subtract(interest);
            }
            balance = balance.subtract(principal);
            rows.add(new ScheduleRow(i, firstPaymentDate.plusMonths(i - 1L), pay, principal, interest, balance));
        }
        return rows;
    }

    private BigDecimal monthlyRate() {
        return tariff.annualRatePercent().divide(HUNDRED, MC).divide(TWELVE, MC);
    }
}
