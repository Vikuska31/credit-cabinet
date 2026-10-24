package ru.creditcabinet.backend.notification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

public class InMemoryNotificationRepository implements NotificationRepository {
    private final List<Notification> all = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong();

    @Override public synchronized void add(String recipient, String text, String applicationId, Instant createdAt) {
        all.add(new Notification(seq.incrementAndGet(), recipient, text, applicationId, createdAt, false));
    }

    @Override public synchronized List<Notification> findByRecipient(String recipient) {
        return all.stream().filter(n -> n.recipient().equals(recipient))
                .sorted(Comparator.comparing(Notification::createdAt).reversed().thenComparing(Notification::id, Comparator.reverseOrder()))
                .toList();
    }

    @Override public synchronized void markRead(String recipient, long id) {
        for (int i = 0; i < all.size(); i++) {
            Notification n = all.get(i);
            if (n.id() == id && n.recipient().equals(recipient)) all.set(i, n.markRead());
        }
    }
}
