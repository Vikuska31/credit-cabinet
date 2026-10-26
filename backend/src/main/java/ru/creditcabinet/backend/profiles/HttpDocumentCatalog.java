package ru.creditcabinet.backend.profiles;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import ru.creditcabinet.backend.application.DocumentCatalog;
import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentType;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Библиотека документов в documents-service (Вика). Предложенный контракт:
 * GET {DOCUMENTS_URL}/companies/{inn}/documents → [{id, type, title, periodFrom, periodTo, version, uploadedAt}],
 * где type — имя из DocumentType (FINANCIAL_SUMMARY…), периоды "2026-07", uploadedAt в формате ISO-8601.
 * Если сервис недоступен, библиотека считается пустой, а не заявка отказом.
 */
public class HttpDocumentCatalog implements DocumentCatalog {
    public record DocumentDto(String id, DocumentType type, String title, YearMonth periodFrom, YearMonth periodTo,
                              Integer version, Instant uploadedAt) {}

    private final RestClient client;

    public HttpDocumentCatalog(String baseUrl) {
        this(baseUrl, "");
    }

    public HttpDocumentCatalog(String baseUrl, String token) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().baseUrl(baseUrl).defaultHeader("Authorization", "Bearer " + token).requestFactory(factory).build();
    }

    @Override public List<DocumentRef> listByCompany(String inn) {
        try {
            DocumentDto[] body = client.get().uri("/companies/{inn}/documents", inn).retrieve().body(DocumentDto[].class);
            if (body == null) return List.of();
            return Arrays.stream(body).map(d -> new DocumentRef(d.id(), inn, d.type(), d.title(), d.periodFrom(), d.periodTo(),
                    d.version() == null ? 1 : d.version(), d.uploadedAt() == null ? Instant.EPOCH : d.uploadedAt())).toList();
        } catch (RestClientException e) {
            return List.of();
        }
    }

    @Override public Optional<DocumentRef> find(String inn, String documentId) {
        return listByCompany(inn).stream().filter(d -> d.id().equals(documentId)).findFirst();
    }
}
