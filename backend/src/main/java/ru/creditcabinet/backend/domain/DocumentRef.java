package ru.creditcabinet.backend.domain;

import java.time.Instant;
import java.time.YearMonth;

/**
 * Ссылка на документ из библиотеки компании. Сам файл хранит documents-service (Вика);
 * бэкенду нужны только тип, период и версия.
 */
public record DocumentRef(
        String id,
        String companyInn,
        DocumentType type,
        String title,
        YearMonth periodFrom,
        YearMonth periodTo,
        int version,
        Instant uploadedAt) {

    /** Сводка годится, если её период покрывает весь запрошенный интервал. */
    public boolean covers(YearMonth from, YearMonth to) {
        return periodFrom != null && periodTo != null
                && !periodFrom.isAfter(from) && !periodTo.isBefore(to);
    }
}
