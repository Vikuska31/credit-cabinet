package ru.creditcabinet.backend.storage;

import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;
import ru.creditcabinet.backend.application.ApplicationRepository;
import ru.creditcabinet.backend.application.LoanApplication;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Заявки в PostgreSQL: колонки для поиска + полное состояние в JSONB (см. docs/data-model.md). */
public class JdbcApplicationRepository implements ApplicationRepository {
    private final JdbcClient jdbc;
    private final JsonMapper json;

    public JdbcApplicationRepository(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override public String nextId() { return UUID.randomUUID().toString(); }

    @Override public long nextNumber() {
        return jdbc.sql("SELECT nextval('application_number_seq')").query(Long.class).single();
    }

    @Override public void save(LoanApplication a) {
        jdbc.sql("""
                INSERT INTO applications (id, number, company_inn, status, amount, term_months, updated_at, data)
                VALUES (:id, :number, :inn, :status, :amount, :term, :updated, CAST(:data AS jsonb))
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount,
                    term_months = EXCLUDED.term_months, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
                """)
                .param("id", a.id()).param("number", a.number()).param("inn", a.companyInn())
                .param("status", a.status().name()).param("amount", a.amount()).param("term", a.termMonths())
                .param("updated", OffsetDateTime.ofInstant(Instant.now(), ZoneOffset.UTC))
                .param("data", json.writeValueAsString(a.snapshot()))
                .update();
    }

    @Override public Optional<LoanApplication> findById(String id) {
        return jdbc.sql("SELECT data::text FROM applications WHERE id = :id").param("id", id)
                .query(String.class).optional().map(this::read);
    }

    @Override public List<LoanApplication> findByCompany(String inn) {
        return jdbc.sql("SELECT data::text FROM applications WHERE company_inn = :inn ORDER BY number DESC")
                .param("inn", inn).query(String.class).list().stream().map(this::read).toList();
    }

    @Override public List<LoanApplication> findAll() {
        return jdbc.sql("SELECT data::text FROM applications ORDER BY number DESC")
                .query(String.class).list().stream().map(this::read).toList();
    }

    private LoanApplication read(String data) {
        return LoanApplication.restore(json.readValue(data, LoanApplication.Snapshot.class));
    }
}
