package ru.creditcabinet.backend.notification;

import ru.creditcabinet.backend.auth.Principal;

import java.time.Clock;
import java.util.List;

public class NotificationService {
    public static final String EMPLOYEES = "employees";

    private final NotificationRepository repository;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public void notifyCompany(String inn, String text, String applicationId) {
        repository.add(inn, text, applicationId, clock.instant());
    }

    public void notifyEmployees(String text, String applicationId) {
        notifyCompany(EMPLOYEES, text, applicationId);
    }

    public List<Notification> list(Principal p) { return repository.findByRecipient(key(p)); }

    public void markRead(Principal p, long id) { repository.markRead(key(p), id); }

    private static String key(Principal p) { return p.isEmployee() ? EMPLOYEES : p.companyInn(); }
}
