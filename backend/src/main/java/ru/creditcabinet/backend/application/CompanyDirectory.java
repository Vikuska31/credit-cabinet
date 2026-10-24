package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.domain.Company;

import java.util.Optional;

/** Карточка клиента банка. Потом — чтение профилей из data/demo-profiles. */
public interface CompanyDirectory {
    Optional<Company> findByInn(String inn);
}
