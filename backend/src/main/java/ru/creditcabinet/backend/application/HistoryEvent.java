package ru.creditcabinet.backend.application;

import java.time.Instant;

public record HistoryEvent(Instant at, String actor, String type, String message) {}
