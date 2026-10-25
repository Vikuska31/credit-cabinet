package ru.creditcabinet.backend.notification;

import java.time.Instant;

/** Событие для колокольчика. recipient — ИНН компании либо {@link NotificationService#EMPLOYEES}. */
public record Notification(long id, String recipient, String text, String applicationId, Instant createdAt, boolean read) {
    public Notification markRead() { return new Notification(id, recipient, text, applicationId, createdAt, true); }
}
