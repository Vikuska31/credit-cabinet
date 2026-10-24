package ru.creditcabinet.backend.demo;

import ru.creditcabinet.backend.application.CompanyDirectory;
import ru.creditcabinet.backend.application.DocumentCatalog;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.PasswordHasher;
import ru.creditcabinet.backend.auth.UserAccount;
import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.bank.BankData.Completeness;
import ru.creditcabinet.backend.bank.BankData.Meta;
import ru.creditcabinet.backend.bank.BankDataSource;
import ru.creditcabinet.backend.domain.Company;
import ru.creditcabinet.backend.domain.CompanyForm;
import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentType;
import ru.creditcabinet.backend.domain.Role;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static ru.creditcabinet.backend.common.Money.rub;

/**
 * ВРЕМЕННЫЕ демоданные в коде: зеркало data/demo-profiles/profiles.json (Вика).
 * Когда подключим Spring, заменим на чтение профилей и на HTTP-клиенты к mocks/ и documents-service/.
 * Нужны, чтобы ядро можно было запускать и проверять уже сейчас.
 */
public class DemoSeed implements CompanyDirectory, BankDataSource, DocumentCatalog {
    public static final String IP_INN = "772000000001";
    public static final String OOO_INN = "7701000001";
    public static final String RISK_INN = "7702000002";
    public static final String EMPLOYEE_LOGIN = "employee";

    private final Map<String, Company> companies = new HashMap<>();
    private final Map<String, BankData> bankData = new HashMap<>();
    private final List<DocumentRef> documents = new ArrayList<>();
    private final Set<String> failingInns = new java.util.HashSet<>();

    public DemoSeed() {
        LocalDate asOf = LocalDate.of(2026, 10, 20);
        YearMonth jul = YearMonth.of(2026, 7), aug = jul.plusMonths(1), sep = jul.plusMonths(2);

        companies.put(IP_INN, new Company(IP_INN, CompanyForm.IP, "ИП Смирнов Алексей Петрович",
                LocalDate.of(2024, 2, 12), "47.91", "Розничная торговля через интернет"));
        bankData.put(IP_INN, data(asOf, false, 0, 0, "0", null, false, 0, 0, 0, jul, 420_000, 450_000, 480_000));

        companies.put(OOO_INN, new Company(OOO_INN, CompanyForm.OOO, "ООО «Северный ветер»",
                LocalDate.of(2019, 3, 14), "46.39", "Оптовая торговля продуктами питания"));
        bankData.put(OOO_INN, data(asOf, true, 2, 1, "95000", "1800000", false, 0, 0, 0, jul, 2_800_000, 3_100_000, 2_900_000));
        documents.add(new DocumentRef("doc-ooo-1", OOO_INN, DocumentType.FINANCIAL_SUMMARY,
                "Финансовая сводка · июль–сентябрь 2026", jul, sep, 1, Instant.parse("2026-10-05T09:00:00Z")));

        companies.put(RISK_INN, new Company(RISK_INN, CompanyForm.OOO, "ООО «Меридиан»",
                LocalDate.of(2020, 6, 1), "43.21", "Электромонтажные работы"));
        bankData.put(RISK_INN, data(asOf, true, 1, 2, "210000", "6400000", true, 18, 2, 45, jul, 1_900_000, 1_500_000, 1_700_000));
        documents.add(new DocumentRef("doc-risk-1", RISK_INN, DocumentType.FINANCIAL_SUMMARY,
                "Финансовая сводка · июль–сентябрь 2026", jul, sep, 1, Instant.parse("2026-10-06T09:00:00Z")));
    }

    private BankData data(LocalDate asOf, boolean historyExists, int closed, int activeLoans, String monthly, String outstanding,
                          boolean overdueNow, int overdueDays, int pastCount, int maxDays, YearMonth from, long m1, long m2, long m3) {
        Meta bki = new Meta("БКИ (имитация)", asOf, Completeness.FULL);
        return new BankData(
                new BankData.Registry(new Meta("Реестр (имитация)", asOf, Completeness.FULL), "active"),
                new BankData.CreditHistory(bki, historyExists, historyExists ? closed : null),
                new BankData.Obligations(bki, activeLoans, rub(monthly), outstanding == null ? null : rub(outstanding)),
                new BankData.Overdue(bki, overdueNow, overdueNow ? overdueDays : null, pastCount, maxDays),
                new BankData.Inflows(new Meta("Счета клиента в банке (имитация)", asOf, Completeness.FULL), from, from.plusMonths(2),
                        List.of(new BankData.MonthInflow(from, rub(m1)), new BankData.MonthInflow(from.plusMonths(1), rub(m2)),
                                new BankData.MonthInflow(from.plusMonths(2), rub(m3))),
                        rub(m1 + m2 + m3)));
    }

    public void registerAccounts(AuthService auth) {
        auth.register(new UserAccount("demo.ip", "Смирнов Алексей Петрович", Role.CLIENT, IP_INN, PasswordHasher.hash("demo1234")));
        auth.register(new UserAccount("demo.ooo", "Петрова Мария Сергеевна", Role.CLIENT, OOO_INN, PasswordHasher.hash("demo1234")));
        auth.register(new UserAccount("demo.risk", "Кузнецов Дмитрий Олегович", Role.CLIENT, RISK_INN, PasswordHasher.hash("demo1234")));
        // Сотрудник банка в profiles.json не описан — тестовая учётка, пароль нужно утвердить
        auth.register(new UserAccount(EMPLOYEE_LOGIN, "Сотрудник банка (демо)", Role.EMPLOYEE, null, PasswordHasher.hash("employee1234")));
    }

    /** Для тестов: следующий запрос к источнику по этому ИНН завершится сбоем. */
    public void failSource(String inn, boolean fail) {
        if (fail) failingInns.add(inn); else failingInns.remove(inn);
    }

    /** Для тестов: добавить документ в библиотеку (имитация загрузки через documents-service). */
    public void addDocument(DocumentRef ref) { documents.add(ref); }

    @Override public Optional<Company> findByInn(String inn) { return Optional.ofNullable(companies.get(inn)); }

    @Override public BankData fetch(String inn) {
        if (failingInns.contains(inn)) throw new BankDataUnavailableException("Источник временно недоступен (имитация)");
        BankData d = bankData.get(inn);
        if (d == null) throw new BankDataUnavailableException("Компания не найдена в источнике");
        return d;
    }

    @Override public List<DocumentRef> listByCompany(String inn) {
        return documents.stream().filter(d -> d.companyInn().equals(inn)).toList();
    }

    @Override public Optional<DocumentRef> find(String inn, String documentId) {
        return documents.stream().filter(d -> d.companyInn().equals(inn) && d.id().equals(documentId)).findFirst();
    }
}
