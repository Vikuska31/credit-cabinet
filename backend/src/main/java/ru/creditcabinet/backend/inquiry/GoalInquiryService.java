package ru.creditcabinet.backend.inquiry;

import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.notification.NotificationService;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

public class GoalInquiryService {
    private final GoalInquiryRepository repository;
    private final NotificationService notifications;
    private final Clock clock;

    public GoalInquiryService(GoalInquiryRepository repository, NotificationService notifications, Clock clock) {
        this.repository = repository;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** «Передать вопрос сотруднику»: подбор клиента остаётся сохранённым. */
    public synchronized GoalInquiry create(Principal p, String text) {
        p.requireClient();
        if (text == null || text.isBlank()) throw ApiException.validation("text", "Опишите, на что нужны деньги");
        GoalInquiry g = new GoalInquiry(UUID.randomUUID().toString(), p.companyInn(), text.strip(),
                GoalInquiry.Status.OPEN, null, null, clock.instant(), null);
        repository.save(g);
        notifications.notifyEmployees("Вопрос по цели кредита: " + g.text(), null);
        return g;
    }

    public synchronized List<GoalInquiry> listOpen(Principal p) {
        p.requireEmployee();
        return repository.findOpen();
    }

    public synchronized List<GoalInquiry> listMine(Principal p) {
        p.requireClient();
        return repository.findByCompany(p.companyInn());
    }

    /** Сотрудник подтверждает категорию (категория не OTHER) или задаёт уточняющий вопрос (категория null). */
    public synchronized GoalInquiry answer(Principal p, String id, LoanGoal category, String message) {
        p.requireEmployee();
        GoalInquiry g = repository.findById(id).orElseThrow(() -> ApiException.notFound("Запрос не найден"));
        if (category == LoanGoal.OTHER) throw ApiException.validation("category", "Выберите конкретную категорию");
        if (category == null && (message == null || message.isBlank())) {
            throw ApiException.validation("message", "Укажите категорию или задайте уточняющий вопрос");
        }
        GoalInquiry answered = new GoalInquiry(g.id(), g.companyInn(), g.text(), GoalInquiry.Status.ANSWERED,
                category, message, g.createdAt(), clock.instant());
        repository.save(answered);
        notifications.notifyCompany(g.companyInn(),
                category != null ? "Цель уточнена: «%s». Можно продолжить подбор".formatted(category.title())
                        : "Сотрудник задал вопрос по вашей цели: " + message, null);
        return answered;
    }
}
