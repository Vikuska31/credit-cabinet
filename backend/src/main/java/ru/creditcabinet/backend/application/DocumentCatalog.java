package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.domain.DocumentRef;

import java.util.List;
import java.util.Optional;

/** Библиотека документов компании. Потом — HTTP-клиент к documents-service (Вика). */
public interface DocumentCatalog {
    List<DocumentRef> listByCompany(String inn);

    Optional<DocumentRef> find(String inn, String documentId);
}
