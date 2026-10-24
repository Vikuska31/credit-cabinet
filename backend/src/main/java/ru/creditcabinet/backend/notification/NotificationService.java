package ru.creditcabinet.backend.notification;

import ru.creditcabinet.backend.auth.Principal;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

public class NotificationService {
    public static final String EMPLOYEES = "employees";

    private final List<Notification> all = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong();
    private final Clock clock;

    public NotificationService(Clock clock) { this.clock = clock; }

    public synchronized void notifyCompany(String inn, String text, String applicationId) {
        all.add(new Notification(seq.incrementAndGet(), inn, text, applicationId, clock.instant(), false));
    }

    public synchronized void notifyEmployees(String text, String applicationId) {
        notifyCompany(EMPLOYEES, text, applicationId);
    }

    public synchronized List<Notification> list(Principal p) {
        String key = p.isEmployee() ? EMPLOYEES : p.companyInn();
        return all.stream().filter(n -> n.recipient().equals(key))
                .sorted(Comparator.comparing(Notification::createdAt).reversed().thenComparing(Notification::id, Comparator.reverseOrder()))
                .toList();
    }

    public synchronized void markRead(Principal p, long id) {
        String key = p.isEmployee() ? EMPLOYEES : p.companyInn();
        for (int i = 0; i < all.size(); i++) {
            Notification n = all.get(i);
            if (n.id() == id && n.recipient().equals(key)) all.set(i, n.markRead());
        }
    }
}
