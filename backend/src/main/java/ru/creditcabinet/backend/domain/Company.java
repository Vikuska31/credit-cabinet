package ru.creditcabinet.backend.domain;

import java.time.LocalDate;

public record Company(
        String inn,
        CompanyForm form,
        String name,
        LocalDate registeredAt,
        String okvedCode,
        String okvedTitle) {}
