package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.bank.BankDataSource;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.common.ApiException.FieldError;
import ru.creditcabinet.backend.decision.Decision;
import ru.creditcabinet.backend.decision.Decision.ClarificationRequest;
import ru.creditcabinet.backend.decision.DecisionEngine;
import ru.creditcabinet.backend.domain.Company;
import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentRequirements;
import ru.creditcabinet.backend.domain.DocumentType;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.notification.NotificationService;
import ru.creditcabinet.backend.tariff.LoanCalculator;
import ru.creditcabinet.backend.tariff.LoanOffer;
import ru.creditcabinet.backend.tariff.ScheduleRow;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Жизненный цикл заявки: черновик, отправка без дублей, проверка и решение, уточнения,
 * принятие условий и демонстрационная выдача. Все значимые проверки — здесь, на сервере.
 * Методы синхронизированы: повторный клик или параллельный запрос не создаёт второй результат.
 */
public class ApplicationService {
    private final ApplicationRepository repository;
    private final DocumentCatalog documents;
    private final CompanyDirectory companies;
    private final BankDataSource bankSource;
    private final LoanCalculator calculator;
    private final DecisionEngine engine;
    private final NotificationService notifications;
    private final Clock clock;

    public ApplicationService(ApplicationRepository repository, DocumentCatalog documents, CompanyDirectory companies,
                              BankDataSource bankSource, LoanCalculator calculator, DecisionEngine engine,
                              NotificationService notifications, Clock clock) {
        this.repository = repository;
        this.documents = documents;
        this.companies = companies;
        this.bankSource = bankSource;
        this.calculator = calculator;
        this.engine = engine;
        this.notifications = notifications;
        this.clock = clock;
    }

    // ---------- Черновик ----------

    public synchronized ApplicationView createDraft(Principal p) {
        p.requireClient();
        LoanApplication a = new LoanApplication(repository.nextId(), repository.nextNumber(), p.companyInn(), clock.instant());
        a.addHistory(clock.instant(), p.login(), "created", "Создан черновик");
        repository.save(a);
        return view(p, a);
    }

    public synchronized ApplicationView updateDraft(Principal p, String id, DraftUpdate u) {
        p.requireClient();
        LoanApplication a = load(p, id);
        requireStatus(a, ApplicationStatus.DRAFT, "Изменить можно только черновик. После отправки правки идут через запрос уточнения");
        applyUpdate(a, u);
        repository.save(a);
        return view(p, a);
    }

    private void applyUpdate(LoanApplication a, DraftUpdate u) {
        List<FieldError> errors = new ArrayList<>();
        if (u.amount() != null && (u.amount().compareTo(calculator.tariff().minAmount()) < 0
                || u.amount().compareTo(calculator.tariff().maxAmount()) > 0)) {
            errors.add(new FieldError("amount", "Сумма должна быть от %s до %s ₽".formatted(
                    calculator.tariff().minAmount().toBigInteger(), calculator.tariff().maxAmount().toBigInteger())));
        }
        if (u.termMonths() != null && (u.termMonths() < calculator.tariff().minTermMonths()
                || u.termMonths() > calculator.tariff().maxTermMonths())) {
            errors.add(new FieldError("termMonths", "Срок должен быть от %d до %d мес.".formatted(
                    calculator.tariff().minTermMonths(), calculator.tariff().maxTermMonths())));
        }
        if (u.otherGoalCategory() != null && u.otherGoalCategory() == LoanGoal.OTHER) {
            errors.add(new FieldError("otherGoalCategory", "Выберите одну из категорий кроме «Другое»"));
        }
        if (u.attachedDocumentIds() != null) {
            for (String docId : u.attachedDocumentIds()) {
                if (documents.find(a.companyInn(), docId).isEmpty()) {
                    errors.add(new FieldError("attachedDocumentIds", "Документ не найден в библиотеке компании: " + docId));
                }
            }
        }
        if (!errors.isEmpty()) throw ApiException.validation(errors); // введённое клиентом не теряется: ничего не применено, фронт показывает ошибки рядом с полями

        if (u.goals() != null) a.setGoals(u.goals());
        if (u.otherGoalText() != null) a.setOtherGoalText(u.otherGoalText());
        if (u.otherGoalCategory() != null) a.setOtherGoalCategory(u.otherGoalCategory());
        if (u.amount() != null) a.setAmount(u.amount());
        if (u.termMonths() != null) a.setTermMonths(u.termMonths());
        if (u.selectedKind() != null) a.setSelectedKind(u.selectedKind());
        if (u.monthlyIncomeRub() != null) a.setMonthlyIncomeRub(u.monthlyIncomeRub());
        if (u.monthlyExpensesRub() != null) a.setMonthlyExpensesRub(u.monthlyExpensesRub());
        if (u.attachedDocumentIds() != null) {
            a.attachedDocumentIds().clear();
            a.attachedDocumentIds().addAll(u.attachedDocumentIds());
        }
        if (u.consent() != null) a.setConsent(u.consent());
        if (u.step() != null && u.step() >= 1 && u.step() <= 4) a.setStep(u.step());
    }

    /** Шаг «Документы»: что нужно, что приложено, что подходящего найдено в библиотеке. */
    public synchronized List<DocumentCheck> documentChecks(Principal p, String id) {
        p.requireClient();
        LoanApplication a = load(p, id);
        return buildChecks(a);
    }

    /** «Найдена сводка за нужный период. Приложим к заявке» — прикрепляет все найденные подходящие файлы. */
    public synchronized ApplicationView attachSuggested(Principal p, String id) {
        p.requireClient();
        LoanApplication a = load(p, id);
        if (a.status() != ApplicationStatus.DRAFT && a.status() != ApplicationStatus.NEEDS_CLARIFICATION) {
            throw ApiException.conflict("invalid_state", "Сейчас документы менять нельзя");
        }
        for (DocumentCheck c : buildChecks(a)) {
            if (c.attached() == null && c.suggested() != null) a.attachedDocumentIds().add(c.suggested().id());
        }
        repository.save(a);
        return view(p, a);
    }

    private List<DocumentCheck> buildChecks(LoanApplication a) {
        List<DocumentRef> library = documents.listByCompany(a.companyInn());
        Company company = companies.findByInn(a.companyInn()).orElseThrow(() -> ApiException.notFound("Компания не найдена"));
        List<DocumentCheck> checks = new ArrayList<>();
        for (DocumentRequirements.Requirement r : DocumentRequirements.forApplication(company.form(), a.effectiveGoals(),
                a.amount(), calculator.tariff().fullPackageThreshold(), LocalDate.now(clock))) {
            checks.add(check(a, library, r));
        }
        return checks;
    }

    private DocumentCheck check(LoanApplication a, List<DocumentRef> library, DocumentRequirements.Requirement r) {
        Comparator<DocumentRef> newest = Comparator.comparing(DocumentRef::uploadedAt);
        Optional<DocumentRef> attached = library.stream().filter(d -> d.type() == r.type())
                .filter(d -> a.attachedDocumentIds().contains(d.id())).filter(r.suitable()).max(newest);
        Optional<DocumentRef> suggested = library.stream().filter(d -> d.type() == r.type()).filter(r.suitable()).max(newest);
        return new DocumentCheck(r.type(), r.blocksSubmit(), r.reason(), attached.orElse(null),
                attached.isPresent() ? null : suggested.orElse(null));
    }

    // ---------- Отправка ----------

    /** Повторная отправка уже отправленной заявки возвращает её же, не создавая второй запрос. */
    public synchronized ApplicationView submit(Principal p, String id) {
        p.requireClient();
        LoanApplication a = load(p, id);
        if (a.status() != ApplicationStatus.DRAFT) return view(p, a);

        List<FieldError> errors = new ArrayList<>();
        if (a.effectiveGoals().isEmpty() && a.goals().isEmpty()) errors.add(new FieldError("goals", "Выберите хотя бы одну цель"));
        if (a.goals().contains(LoanGoal.OTHER)) {
            if (a.otherGoalText() == null || a.otherGoalText().isBlank()) {
                errors.add(new FieldError("otherGoalText", "Опишите цель"));
            } else if (a.otherGoalCategory() == null) {
                errors.add(new FieldError("otherGoalCategory", "Подтвердите категорию цели или передайте вопрос сотруднику"));
            }
        }
        if (a.amount() == null) errors.add(new FieldError("amount", "Укажите сумму"));
        if (a.termMonths() == null) errors.add(new FieldError("termMonths", "Укажите срок"));
        if (!errors.isEmpty()) throw ApiException.validation(errors);
        calculator.validate(a.amount(), a.termMonths());

        LoanOffer offer = selectedOffer(a);
        if (offer == null) {
            throw ApiException.validation("selectedKind", "Для этого срока второго варианта нет. Выберите расчёт «По вашему запросу»");
        }
        if (!a.consent()) throw ApiException.validation("consent", "Подтвердите согласие на обработку заявки");
        for (DocumentCheck c : buildChecks(a)) {
            if (c.blocksSubmit() && c.attached() == null) {
                throw ApiException.validation("documents", "Не приложен документ: " + c.type().title());
            }
        }

        a.setSubmittedOffer(offer);
        a.setSubmittedAt(clock.instant());
        a.transitionTo(ApplicationStatus.UNDER_REVIEW);
        a.addHistory(clock.instant(), p.login(), "submitted", "Заявка отправлена: %s ₽ на %d мес.".formatted(offer.amount(), offer.termMonths()));
        notifications.notifyEmployees("Новая заявка №" + a.number(), a.id());
        review(a, p.login());
        repository.save(a);
        return view(p, a);
    }

    private LoanOffer selectedOffer(LoanApplication a) {
        List<LoanOffer> offers = calculator.offers(a.amount(), a.termMonths());
        return offers.stream().filter(o -> o.kind() == a.selectedKind()).findFirst().orElse(null);
    }

    // ---------- Проверка и решение ----------

    private void review(LoanApplication a, String actor) {
        Company company = companies.findByInn(a.companyInn())
                .orElseThrow(() -> ApiException.notFound("Компания не найдена"));
        BankData data;
        try {
            data = bankSource.fetch(a.companyInn());
        } catch (BankDataSource.BankDataUnavailableException e) {
            // Сбой источника — не отказ и не нулевые показатели
            a.transitionTo(ApplicationStatus.CHECK_FAILED);
            a.addHistory(clock.instant(), "system", "check_failed", "Проверка не завершена: источник недоступен. Можно повторить");
            notifications.notifyCompany(a.companyInn(), "Проверка заявки №%d не завершена из-за технического сбоя. Повторите проверку".formatted(a.number()), a.id());
            return;
        }
        a.setBankDataSnapshot(data);
        List<DocumentRef> attached = a.attachedDocumentIds().stream()
                .map(docId -> documents.find(a.companyInn(), docId)).flatMap(Optional::stream).toList();
        Decision decision = engine.decide(new DecisionEngine.Input(company, a.effectiveGoals(), a.submittedOffer(), data, attached));
        a.setDecision(decision);
        a.setOpenRequests(decision.requests());
        String text;
        switch (decision.outcome()) {
            case APPROVED -> {
                a.setFinalOffer(decision.offer());
                a.transitionTo(ApplicationStatus.APPROVED);
                text = "Заявка №%d одобрена на запрошенных условиях".formatted(a.number());
            }
            case COUNTER_OFFER -> {
                a.setFinalOffer(decision.offer());
                a.transitionTo(ApplicationStatus.COUNTER_OFFERED);
                text = "По заявке №%d предложены другие условия".formatted(a.number());
            }
            case NEEDS_INFO -> {
                a.transitionTo(ApplicationStatus.NEEDS_CLARIFICATION);
                text = "По заявке №%d нужно уточнение".formatted(a.number());
            }
            default -> {
                a.transitionTo(ApplicationStatus.REJECTED);
                text = "По заявке №%d принято решение об отказе".formatted(a.number());
            }
        }
        a.addHistory(clock.instant(), "system", "decision",
                text + ": " + String.join("; ", decision.reasons().stream().map(Decision.Reason::text).toList()));
        notifications.notifyCompany(a.companyInn(), text, a.id());
    }

    /** Повтор технически неудавшейся проверки: клиент своей заявки или сотрудник. */
    public synchronized ApplicationView retryCheck(Principal p, String id) {
        LoanApplication a = load(p, id);
        if (a.status() != ApplicationStatus.CHECK_FAILED) return view(p, a);
        a.transitionTo(ApplicationStatus.UNDER_REVIEW);
        a.addHistory(clock.instant(), p.login(), "check_retry", "Проверка запущена повторно");
        review(a, p.login());
        repository.save(a);
        return view(p, a);
    }

    // ---------- Уточнения ----------

    /** Сотрудник просит конкретное поле или документ. История сохраняется, клиент получает уведомление. */
    public synchronized ApplicationView requestClarification(Principal p, String id, String field, DocumentType type, String message) {
        p.requireEmployee();
        if (message == null || message.isBlank()) throw ApiException.validation("message", "Объясните, что нужно уточнить");
        LoanApplication a = load(p, id);
        if (a.status() != ApplicationStatus.NEEDS_CLARIFICATION) a.transitionTo(ApplicationStatus.NEEDS_CLARIFICATION);
        List<ClarificationRequest> requests = new ArrayList<>(a.openRequests());
        requests.add(new ClarificationRequest(field, type, message));
        a.setOpenRequests(requests);
        a.addHistory(clock.instant(), p.login(), "clarification_requested", message);
        notifications.notifyCompany(a.companyInn(), "По заявке №%d нужно уточнение: %s".formatted(a.number(), message), a.id());
        repository.save(a);
        return view(p, a);
    }

    /** «Дополнить»: клиент добавляет документы или ответы, та же заявка проверяется заново. */
    public synchronized ApplicationView respondToClarification(Principal p, String id, Set<String> attachedDocumentIds,
                                                               BigDecimal monthlyIncomeRub, BigDecimal monthlyExpensesRub) {
        p.requireClient();
        LoanApplication a = load(p, id);
        if (a.status() != ApplicationStatus.NEEDS_CLARIFICATION) {
            throw ApiException.conflict("invalid_state", "По этой заявке сейчас нет открытого запроса уточнения");
        }
        applyUpdate(a, new DraftUpdate(null, null, null, null, null, null, monthlyIncomeRub, monthlyExpensesRub,
                mergedAttachments(a, attachedDocumentIds), null, null));
        a.transitionTo(ApplicationStatus.UNDER_REVIEW);
        a.addHistory(clock.instant(), p.login(), "clarification_answered", "Клиент дополнил заявку");
        review(a, p.login());
        repository.save(a);
        return view(p, a);
    }

    private Set<String> mergedAttachments(LoanApplication a, Set<String> added) {
        Set<String> all = new java.util.LinkedHashSet<>(a.attachedDocumentIds());
        if (added != null) all.addAll(added);
        return all;
    }

    // ---------- Принятие условий ----------

    /** «Принять условия» → демо-подписание → моделируемая выдача. Повторный вызов не выдаёт кредит второй раз. */
    public synchronized ApplicationView acceptOffer(Principal p, String id) {
        p.requireClient();
        LoanApplication a = load(p, id);
        if (a.status() == ApplicationStatus.ISSUED) return view(p, a);
        if (a.status() != ApplicationStatus.APPROVED && a.status() != ApplicationStatus.COUNTER_OFFERED) {
            throw ApiException.conflict("invalid_state", "Принять условия можно только после одобрения или встречного предложения");
        }
        a.transitionTo(ApplicationStatus.ISSUED);
        a.setIssuedAt(clock.instant());
        a.addHistory(clock.instant(), p.login(), "accepted", "Клиент принял условия");
        a.addHistory(clock.instant(), "system", "demo_signed", "Демонстрационное подписание (юридической силы нет)");
        a.addHistory(clock.instant(), "system", "demo_issued", "Моделируемая выдача: реальные деньги не переводятся");
        notifications.notifyCompany(a.companyInn(), "Кредит по заявке №%d оформлен — демо".formatted(a.number()), a.id());
        repository.save(a);
        return view(p, a);
    }

    /** Отказ клиента фиксируется отдельно от банковского отказа. */
    public synchronized ApplicationView declineOffer(Principal p, String id) {
        p.requireClient();
        LoanApplication a = load(p, id);
        if (a.status() == ApplicationStatus.DECLINED_BY_CLIENT) return view(p, a);
        if (a.status() != ApplicationStatus.APPROVED && a.status() != ApplicationStatus.COUNTER_OFFERED) {
            throw ApiException.conflict("invalid_state", "Отказаться от предложения можно, пока оно ждёт ответа");
        }
        a.transitionTo(ApplicationStatus.DECLINED_BY_CLIENT);
        a.addHistory(clock.instant(), p.login(), "declined", "Клиент отказался от предложения");
        repository.save(a);
        return view(p, a);
    }

    /** График платежей по окончательному предложению. */
    public synchronized List<ScheduleRow> schedule(Principal p, String id) {
        LoanApplication a = load(p, id);
        if (a.finalOffer() == null) throw ApiException.conflict("no_offer", "По заявке пока нет окончательного предложения");
        LocalDate start = (a.issuedAt() != null ? a.issuedAt() : clock.instant()).atZone(ZoneOffset.UTC).toLocalDate().plusMonths(1);
        return calculator.schedule(a.finalOffer().amount(), a.finalOffer().termMonths(), start);
    }

    // ---------- Чтение ----------

    public synchronized List<ApplicationView> list(Principal p, ApplicationStatus statusFilter) {
        List<LoanApplication> source = p.isEmployee()
                ? repository.findAll().stream().filter(a -> a.status() != ApplicationStatus.DRAFT).toList()
                : repository.findByCompany(p.companyInn());
        return source.stream().filter(a -> statusFilter == null || a.status() == statusFilter)
                .map(a -> view(p, a)).toList();
    }

    public synchronized ApplicationView get(Principal p, String id) {
        return view(p, load(p, id));
    }

    private ApplicationView view(Principal p, LoanApplication a) {
        return ApplicationView.of(a, p.isEmployee());
    }

    /** Чужую заявку не раскрываем: для клиента она «не найдена». Сотрудник не видит чужие черновики. */
    private LoanApplication load(Principal p, String id) {
        LoanApplication a = repository.findById(id).orElseThrow(() -> ApiException.notFound("Заявка не найдена"));
        if (p.isEmployee()) {
            if (a.status() == ApplicationStatus.DRAFT) throw ApiException.notFound("Заявка не найдена");
        } else if (!a.companyInn().equals(p.companyInn())) {
            throw ApiException.notFound("Заявка не найдена");
        }
        return a;
    }

    private void requireStatus(LoanApplication a, ApplicationStatus expected, String message) {
        if (a.status() != expected) throw ApiException.conflict("invalid_state", message);
    }
}
