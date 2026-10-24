package ru.creditcabinet.backend.notification;

import java.time.Instant;
import java.util.List;

public interface NotificationRepository {
    void add(String recipient, String text, String applicationId, Instant createdAt);

    /** Новые сверху. */
    List<Notification> findByRecipient(String recipient);

    void markRead(String recipient, long id);
}
