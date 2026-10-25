package ru.creditcabinet.backend.application;

import java.util.List;
import java.util.Optional;

/** Хранилище заявок. Потом — JPA/PostgreSQL; сейчас в памяти. */
public interface ApplicationRepository {
    String nextId();

    long nextNumber();

    void save(LoanApplication application);

    Optional<LoanApplication> findById(String id);

    List<LoanApplication> findByCompany(String inn);

    List<LoanApplication> findAll();
}
