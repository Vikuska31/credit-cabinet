package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentType;

/** Строка комплекта на шаге «Документы»: что нужно, что приложено, что найдено в библиотеке. */
public record DocumentCheck(DocumentType type, boolean blocksSubmit, DocumentRef attached, DocumentRef suggested) {}
