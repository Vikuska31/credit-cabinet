package ru.creditcabinet.backend.auth;

import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.domain.Role;

/** Кто выполняет запрос. companyInn у сотрудника null. */
public record Principal(String login, String fullName, Role role, String companyInn) {

    public boolean isEmployee() { return role == Role.EMPLOYEE; }

    public Principal requireEmployee() {
        if (!isEmployee()) throw ApiException.forbidden("Действие доступно только сотруднику банка");
        return this;
    }

    public Principal requireClient() {
        if (isEmployee()) throw ApiException.forbidden("Действие доступно только клиенту");
        return this;
    }
}
