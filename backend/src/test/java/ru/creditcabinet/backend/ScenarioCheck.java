package ru.creditcabinet.backend;

import ru.creditcabinet.backend.application.*;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.decision.DecisionEngine;
import ru.creditcabinet.backend.demo.DemoSeed;
import ru.creditcabinet.backend.domain.*;
import ru.creditcabinet.backend.notification.NotificationService;
import ru.creditcabinet.backend.tariff.*;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

/**
 * Самопроверка ядра без внешних библиотек (JUnit подключим вместе со Spring).
 * Запуск: см. backend/README.md. При первой ошибке завершается с кодом 1.
 */
public class ScenarioCheck {
    static int passed;

    static void check(boolean cond, String name) {
        if (!cond) { System.err.println("ПРОВАЛ: " + name); System.exit(1); }
        passed++;
        System.out.println("ok   " + name);
    }

    static ApiException expectError(Runnable r) {
        try { r.run(); } catch (ApiException e) { return e; }
        throw new AssertionError("ожидалась ApiException");
    }

    public static void main(String[] args) {
        Clock clock = Clock.fixed(Instant.parse("2026-10-24T10:00:00Z"), ZoneOffset.UTC);
        LoanCalculator calc = new LoanCalculator(Tariff.DEMO);
        DemoSeed seed = new DemoSeed();
        AuthService auth = new AuthService();
        seed.registerAccounts(auth);
        NotificationService notes = new NotificationService(clock);
        ApplicationService apps = new ApplicationService(new InMemoryApplicationRepository(), seed, seed, seed, calc,
                new DecisionEngine(calc, clock), notes, clock);

        // --- калькулятор ---
        List<LoanOffer> offers = calc.offers(new BigDecimal("1000000"), 24);
        check(offers.size() == 2, "два расчёта для срока 24");
        check(offers.get(1).termMonths() == 36 && offers.get(1).monthlyPayment().compareTo(offers.get(0).monthlyPayment()) < 0, "второй расчёт: срок длиннее, платёж меньше");
        check(offers.get(1).totalInterest().compareTo(offers.get(0).totalInterest()) > 0, "второй расчёт: проценты больше");
        check(offers.get(0).monthlyPayment().compareTo(new BigDecimal("51385.65")) == 0, "платёж 1 млн / 24 мес / 21% = 51 385,65 (сверено независимым расчётом)");
        check(calc.offers(new BigDecimal("500000"), 60).size() == 1, "на максимальном сроке один расчёт");
        check(expectError(() -> calc.offers(new BigDecimal("50"), 24)).fieldErrors().get(0).field().equals("amount"), "ошибка диапазона привязана к полю amount");
        BigDecimal sum = calc.schedule(new BigDecimal("1000000"), 24, java.time.LocalDate.of(2026, 11, 24)).stream()
                .map(ScheduleRow::principal).reduce(BigDecimal.ZERO, BigDecimal::add);
        check(sum.compareTo(new BigDecimal("1000000.00")) == 0, "сумма основного долга в графике = сумме кредита");

        // --- вход ---
        check(expectError(() -> auth.login("demo.ip", "wrong", Role.CLIENT)).status() == 401, "неверный пароль → 401");
        check(expectError(() -> auth.login("employee", "employee1234", Role.CLIENT)).status() == 401, "сотрудник не входит как клиент");
        check(expectError(() -> auth.login("demo.ip", "demo1234", Role.EMPLOYEE)).status() == 401, "клиент не входит как сотрудник");
        Principal ip = auth.authenticate(auth.login("demo.ip", "demo1234", Role.CLIENT));
        Principal ooo = auth.authenticate(auth.loginDemoProfile("demo.ooo"));
        Principal risk = auth.authenticate(auth.loginDemoProfile("demo.risk"));
        Principal emp = auth.authenticate(auth.login("employee", "employee1234", Role.EMPLOYEE));

        // --- ИП новичок: нужно уточнение → загрузка → одобрение → выдача ---
        ApplicationView d1 = apps.createDraft(ip);
        apps.updateDraft(ip, d1.id(), new DraftUpdate(Set.of(LoanGoal.GOODS, LoanGoal.ADVERTISING), null, null,
                new BigDecimal("500000"), 12, LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        check(expectError(() -> apps.updateDraft(ip, d1.id(), new DraftUpdate(null, null, null, new BigDecimal("1"), null, null, null, null, null, null, null))).status() == 400, "сумма вне диапазона отклонена");
        check(apps.get(ip, d1.id()).amount().compareTo(new BigDecimal("500000")) == 0, "введённое не пропало после ошибки");
        ApplicationView s1 = apps.submit(ip, d1.id());
        check(s1.status() == ApplicationStatus.NEEDS_CLARIFICATION, "ИП без сводки → нужно уточнение, а не отказ");
        check(s1.decision().requests().get(0).documentType() == DocumentType.FINANCIAL_SUMMARY, "запрошена финансовая сводка");
        check(apps.submit(ip, d1.id()).number() == s1.number() && apps.list(ip, null).size() == 1, "повторная отправка не создаёт дубль");
        seed.addDocument(new DocumentRef("doc-ip-1", DemoSeed.IP_INN, DocumentType.FINANCIAL_SUMMARY, "Сводка ИП",
                YearMonth.of(2026, 7), YearMonth.of(2026, 9), 1, Instant.parse("2026-10-24T09:00:00Z")));
        ApplicationView s1b = apps.respondToClarification(ip, d1.id(), Set.of("doc-ip-1"), null, null);
        check(s1b.status() == ApplicationStatus.APPROVED, "после сводки заявка одобрена на запрошенных условиях");
        check(s1b.bankData() == null, "клиент не видит сырые банковские проверки");
        check(apps.get(emp, d1.id()).bankData() != null, "сотрудник видит результаты проверок");
        ApplicationView issued = apps.acceptOffer(ip, d1.id());
        check(issued.status() == ApplicationStatus.ISSUED, "кредит оформлен (демо)");
        int events = apps.get(ip, d1.id()).history().size();
        apps.acceptOffer(ip, d1.id());
        check(apps.get(ip, d1.id()).history().size() == events, "повторное принятие не создаёт вторую выдачу");
        check(apps.schedule(ip, d1.id()).size() == 12, "график на 12 платежей");

        // --- ООО с историей: сводка уже в библиотеке ---
        ApplicationView d2 = apps.createDraft(ooo);
        apps.updateDraft(ooo, d2.id(), new DraftUpdate(Set.of(LoanGoal.EXPENSES), null, null, new BigDecimal("1500000"), 24,
                LoanOffer.Kind.LOWER_PAYMENT, null, null, null, true, 4));
        check(apps.documentChecks(ooo, d2.id()).get(0).suggested() != null, "подходящая сводка найдена в библиотеке");
        apps.attachSuggested(ooo, d2.id());
        ApplicationView s2 = apps.submit(ooo, d2.id());
        check(s2.status() == ApplicationStatus.APPROVED && s2.finalOffer().termMonths() == 36, "ООО одобрено, выбран вариант с меньшим платежом");

        // --- Встречное предложение при высокой нагрузке ---
        ApplicationView d3 = apps.createDraft(ip);
        apps.updateDraft(ip, d3.id(), new DraftUpdate(Set.of(LoanGoal.EXPENSES), null, null, new BigDecimal("3000000"), 12,
                LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        apps.attachSuggested(ip, d3.id());
        ApplicationView s3 = apps.submit(ip, d3.id());
        check(s3.status() == ApplicationStatus.COUNTER_OFFERED && !s3.decision().changes().isEmpty(), "большая сумма → встречное предложение с перечнем изменений");
        check(apps.declineOffer(ip, d3.id()).status() == ApplicationStatus.DECLINED_BY_CLIENT, "отказ клиента фиксируется отдельно от отказа банка");

        // --- Риск просрочки ---
        ApplicationView d4 = apps.createDraft(risk);
        apps.updateDraft(risk, d4.id(), new DraftUpdate(Set.of(LoanGoal.GOODS), null, null, new BigDecimal("300000"), 12,
                LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        apps.attachSuggested(risk, d4.id());
        ApplicationView s4 = apps.submit(risk, d4.id());
        check(s4.status() == ApplicationStatus.REJECTED && s4.decision().reasons().get(0).code().equals("current_overdue"), "полный комплект ≠ одобрение: отказ по текущей просрочке");

        // --- Оборудование требует документ до отправки ---
        ApplicationView d5 = apps.createDraft(ooo);
        apps.updateDraft(ooo, d5.id(), new DraftUpdate(Set.of(LoanGoal.EQUIPMENT), null, null, new BigDecimal("800000"), 12,
                LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        check(expectError(() -> apps.submit(ooo, d5.id())).fieldErrors().get(0).field().equals("documents"), "оборудование без документа не отправить");

        // --- «Другое» ---
        ApplicationView d6 = apps.createDraft(ooo);
        apps.updateDraft(ooo, d6.id(), new DraftUpdate(Set.of(LoanGoal.OTHER), "Запустить новое направление", null,
                new BigDecimal("400000"), 12, LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        check(expectError(() -> apps.submit(ooo, d6.id())).fieldErrors().get(0).field().equals("otherGoalCategory"), "неподтверждённая цель «Другое» не отправляется");

        // --- Сбой источника ---
        ApplicationView d7 = apps.createDraft(ooo);
        apps.updateDraft(ooo, d7.id(), new DraftUpdate(Set.of(LoanGoal.GOODS), null, null, new BigDecimal("400000"), 12,
                LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        apps.attachSuggested(ooo, d7.id());
        seed.failSource(DemoSeed.OOO_INN, true);
        check(apps.submit(ooo, d7.id()).status() == ApplicationStatus.CHECK_FAILED, "сбой источника → CHECK_FAILED, не отказ");
        seed.failSource(DemoSeed.OOO_INN, false);
        check(apps.retryCheck(emp, d7.id()).status() == ApplicationStatus.APPROVED, "повтор проверки после сбоя");

        // --- Запрос сотрудника ---
        ApplicationView s7 = apps.requestClarification(emp, d7.id(), "purpose", null, "Уточните назначение суммы");
        check(s7.status() == ApplicationStatus.NEEDS_CLARIFICATION && !notes.list(ooo).isEmpty(), "запрос сотрудника → статус и уведомление клиенту");

        // --- Полный пакет для суммы выше порога ---
        ApplicationView d8 = apps.createDraft(ooo);
        apps.updateDraft(ooo, d8.id(), new DraftUpdate(Set.of(LoanGoal.REPAIR, LoanGoal.GOODS), null, null, new BigDecimal("5000000"), 36,
                LoanOffer.Kind.REQUESTED, null, null, null, true, 4));
        check(apps.documentChecks(ooo, d8.id()).size() == 6, "ООО, 5 млн, ремонт: сводка, декларация, отчётность, справка ФНС, смета, помещение");
        seed.addDocument(new DocumentRef("d8-est", DemoSeed.OOO_INN, DocumentType.REPAIR_ESTIMATE, "Смета", null, null, 1, Instant.parse("2026-10-20T09:00:00Z")));
        seed.addDocument(new DocumentRef("d8-lease", DemoSeed.OOO_INN, DocumentType.PREMISES_RIGHTS, "Аренда", null, null, 1, Instant.parse("2026-10-20T09:00:00Z")));
        apps.attachSuggested(ooo, d8.id());
        ApplicationView s8 = apps.submit(ooo, d8.id());
        check(s8.status() == ApplicationStatus.NEEDS_CLARIFICATION && s8.decision().requests().size() == 3, "без отчётности и справки ФНС — запрос трёх документов, не отказ");
        seed.addDocument(new DocumentRef("d8-tax", DemoSeed.OOO_INN, DocumentType.TAX_DECLARATION, "Декларация 2025", YearMonth.of(2025, 1), YearMonth.of(2025, 12), 1, Instant.parse("2026-04-20T09:00:00Z")));
        seed.addDocument(new DocumentRef("d8-acc", DemoSeed.OOO_INN, DocumentType.ACCOUNTING_REPORTS, "Отчётность 2025", YearMonth.of(2025, 1), YearMonth.of(2025, 12), 1, Instant.parse("2026-04-20T09:00:00Z")));
        seed.addDocument(new DocumentRef("d8-cert", DemoSeed.OOO_INN, DocumentType.TAX_DEBT_CERTIFICATE, "Справка ФНС", null, null, 1, Instant.parse("2026-10-15T09:00:00Z")));
        ApplicationView s8b = apps.respondToClarification(ooo, d8.id(), Set.of("d8-tax", "d8-acc", "d8-cert"), null, null);
        check(s8b.status() != ApplicationStatus.NEEDS_CLARIFICATION && s8b.status() != ApplicationStatus.CHECK_FAILED, "с полным пакетом заявка доходит до решения: " + s8b.status());

        // --- Доступ ---
        check(expectError(() -> apps.get(ip, d2.id())).status() == 404, "чужая заявка клиенту недоступна");
        check(expectError(() -> apps.get(emp, d5.id())).status() == 404, "сотрудник не видит чужие черновики");
        check(expectError(() -> apps.requestClarification(ooo, d2.id(), "x", null, "y")).status() == 403, "клиент не имеет прав сотрудника");
        check(expectError(() -> apps.createDraft(emp)).status() == 403, "сотрудник не создаёт заявки");
        check(apps.list(emp, null).stream().noneMatch(v -> v.status() == ApplicationStatus.DRAFT), "в списке сотрудника нет черновиков");

        System.out.println("\nПройдено проверок: " + passed);
    }
}
