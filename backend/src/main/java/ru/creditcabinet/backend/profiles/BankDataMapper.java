package ru.creditcabinet.backend.profiles;

import tools.jackson.databind.JsonNode;
import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.bank.BankData.Completeness;
import ru.creditcabinet.backend.bank.BankData.Meta;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Превращает JSON моков (GET /bank-data/{inn}, он же блок bank_data в profiles.json) в {@link BankData}.
 * Отсутствующий блок или поле остаётся null: неизвестное не заменяем нулём.
 */
public final class BankDataMapper {
    private BankDataMapper() {}

    public static BankData fromJson(JsonNode n) {
        return new BankData(registry(n.get("registry")), creditHistory(n.get("credit_history")),
                obligations(n.get("obligations")), overdue(n.get("overdue")), inflows(n.get("inflows")));
    }

    private static boolean absent(JsonNode n) { return n == null || n.isNull() || n.isMissingNode(); }

    private static Meta meta(JsonNode n) {
        String c = text(n, "completeness");
        Completeness completeness = Completeness.UNKNOWN;
        if (c != null) {
            try { completeness = Completeness.valueOf(c.toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException ignored) { }
        }
        String asOf = text(n, "as_of");
        return new Meta(text(n, "source"), asOf == null ? null : LocalDate.parse(asOf), completeness);
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return absent(v) ? null : v.asString();
    }

    private static Integer integer(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return absent(v) ? null : v.asInt();
    }

    private static Boolean bool(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return absent(v) ? null : v.asBoolean();
    }

    private static BigDecimal decimal(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return absent(v) ? null : v.decimalValue().setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static BankData.Registry registry(JsonNode n) {
        return absent(n) ? null : new BankData.Registry(meta(n), text(n, "status"));
    }

    private static BankData.CreditHistory creditHistory(JsonNode n) {
        return absent(n) ? null : new BankData.CreditHistory(meta(n), bool(n, "exists"), integer(n, "closed_loans_count"));
    }

    private static BankData.Obligations obligations(JsonNode n) {
        return absent(n) ? null : new BankData.Obligations(meta(n), integer(n, "active_loans_count"),
                decimal(n, "monthly_payments_rub"), decimal(n, "outstanding_rub"));
    }

    private static BankData.Overdue overdue(JsonNode n) {
        return absent(n) ? null : new BankData.Overdue(meta(n), bool(n, "current"), integer(n, "current_days"),
                integer(n, "past_count"), integer(n, "max_days"));
    }

    private static BankData.Inflows inflows(JsonNode n) {
        if (absent(n)) return null;
        List<BankData.MonthInflow> months = new ArrayList<>();
        JsonNode arr = n.get("by_month_rub");
        if (!absent(arr)) {
            for (JsonNode m : arr) {
                months.add(new BankData.MonthInflow(YearMonth.parse(text(m, "month")), decimal(m, "amount_rub")));
            }
        }
        String from = text(n, "period_from"), to = text(n, "period_to");
        return new BankData.Inflows(meta(n), from == null ? null : YearMonth.from(LocalDate.parse(from)),
                to == null ? null : YearMonth.from(LocalDate.parse(to)), months, decimal(n, "total_rub"));
    }
}
