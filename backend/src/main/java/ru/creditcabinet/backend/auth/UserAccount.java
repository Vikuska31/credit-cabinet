package ru.creditcabinet.backend.auth;

import ru.creditcabinet.backend.domain.Role;

public record UserAccount(String login, String fullName, Role role, String companyInn, String passwordHash) {}
