package ru.creditcabinet.backend.storage;

import org.springframework.jdbc.core.simple.JdbcClient;
import ru.creditcabinet.backend.notification.Notification;
import ru.creditcabinet.backend.notification.NotificationRepository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

public class JdbcNotificationRepository implements NotificationRepository {
    private final JdbcClient jdbc;

    public JdbcNotificationRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public void add(String recipient, String text, String applicationId, Instant createdAt) {
        jdbc.sql("INSERT INTO notifications (recipient, text, application_id, created_at) VALUES (:r, :t, :a, :c)")
                .param("r", recipient).param("t", text).param("a", applicationId)
                .param("c", OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC)).update();
    }

    @Override public List<Notification> findByRecipient(String recipient) {
        return jdbc.sql("SELECT id, recipient, text, application_id, created_at, read FROM notifications WHERE recipient = :r ORDER BY created_at DESC, id DESC")
                .param("r", recipient)
                .query((rs, n) -> new Notification(rs.getLong("id"), rs.getString("recipient"), rs.getString("text"),
                        rs.getString("application_id"), rs.getObject("created_at", OffsetDateTime.class).toInstant(), rs.getBoolean("read")))
                .list();
    }

    @Override public void markRead(String recipient, long id) {
        jdbc.sql("UPDATE notifications SET read = TRUE WHERE id = :id AND recipient = :r").param("id", id).param("r", recipient).update();
    }
}
