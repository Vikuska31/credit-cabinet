package ru.creditcabinet.backend.inquiry;

import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.notification.NotificationService;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class GoalInquiryService {
    private final Map<String, GoalInquiry> store = new LinkedHashMap<>();
    private final NotificationService notifications;
    private final Clock clock;

    public GoalInquiryService(NotificationService notifications, Clock clock) {
        this.notifications = notifications;
        this.clock = clock;
    }

    /** «Передать вопрос сотруднику»: подбор клиента остаётся сохранённым. */
    public synchronized GoalInquiry create(Principal p, String text) {
        p.requireClient();
        if (text == null || text.isBlank()) throw ApiException.validation("text", "Опишите, на что нужны деньги");
        GoalInquiry g = new GoalInquiry(UUID.randomUUID().toString(), p.companyInn(), text.strip(),
                GoalInquiry.Status.OPEN, null, null, clock.instant(), null);
        store.put(g.id(), g);
        notifications.notifyEmployees("Вопрос по цели кредита: " + g.text(), null);
        return g;
    }

    public synchronized List<GoalInquiry> listOpen(Principal p) {
        p.requireEmployee();
        return store.values().stream().filter(g -> g.status() == GoalInquiry.Status.OPEN).toList();
    }

    public synchronized List<GoalInquiry> listMine(Principal p) {
        p.requireClient();
        List<GoalInquiry> mine = new ArrayList<>(store.values().stream().filter(g -> g.companyInn().equals(p.companyInn())).toList());
        mine.sort(Comparator.comparing(GoalInquiry::createdAt).reversed());
        return mine;
    }

    /** Сотрудник подтверждает категорию (категория не OTHER) или задаёт уточняющий вопрос (категория null). */
    public synchronized GoalInquiry answer(Principal p, String id, LoanGoal category, String message) {
        p.requireEmployee();
        GoalInquiry g = store.get(id);
        if (g == null) throw ApiException.notFound("Запрос не найден");
        if (category == LoanGoal.OTHER) throw ApiException.validation("category", "Выберите конкретную категорию");
        if (category == null && (message == null || message.isBlank())) {
            throw ApiException.validation("message", "Укажите категорию или задайте уточняющий вопрос");
        }
        GoalInquiry answered = new GoalInquiry(g.id(), g.companyInn(), g.text(), GoalInquiry.Status.ANSWERED,
                category, message, g.createdAt(), clock.instant());
        store.put(id, answered);
        notifications.notifyCompany(g.companyInn(),
                category != null ? "Цель уточнена: «%s». Можно продолжить подбор".formatted(category.title())
                        : "Сотрудник задал вопрос по вашей цели: " + message, null);
        return answered;
    }
}
