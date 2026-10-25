package ru.creditcabinet.backend.storage;

import org.springframework.jdbc.core.simple.JdbcClient;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.inquiry.GoalInquiry;
import ru.creditcabinet.backend.inquiry.GoalInquiryRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

public class JdbcGoalInquiryRepository implements GoalInquiryRepository {
    private static final String COLUMNS = "id, company_inn, text, status, suggested_category, employee_message, created_at, answered_at";
    private final JdbcClient jdbc;

    public JdbcGoalInquiryRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public void save(GoalInquiry g) {
        jdbc.sql("""
                INSERT INTO goal_inquiries (id, company_inn, text, status, suggested_category, employee_message, created_at, answered_at)
                VALUES (:id, :inn, :text, :status, :cat, :msg, :created, :answered)
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, suggested_category = EXCLUDED.suggested_category,
                    employee_message = EXCLUDED.employee_message, answered_at = EXCLUDED.answered_at
                """)
                .param("id", g.id()).param("inn", g.companyInn()).param("text", g.text()).param("status", g.status().name())
                .param("cat", g.suggestedCategory() == null ? null : g.suggestedCategory().name())
                .param("msg", g.employeeMessage())
                .param("created", OffsetDateTime.ofInstant(g.createdAt(), ZoneOffset.UTC))
                .param("answered", g.answeredAt() == null ? null : OffsetDateTime.ofInstant(g.answeredAt(), ZoneOffset.UTC))
                .update();
    }

    @Override public Optional<GoalInquiry> findById(String id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM goal_inquiries WHERE id = :id").param("id", id)
                .query(JdbcGoalInquiryRepository::map).optional();
    }

    @Override public List<GoalInquiry> findOpen() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM goal_inquiries WHERE status = 'OPEN' ORDER BY created_at")
                .query(JdbcGoalInquiryRepository::map).list();
    }

    @Override public List<GoalInquiry> findByCompany(String inn) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM goal_inquiries WHERE company_inn = :inn ORDER BY created_at DESC")
                .param("inn", inn).query(JdbcGoalInquiryRepository::map).list();
    }

    private static GoalInquiry map(ResultSet rs, int n) throws SQLException {
        String cat = rs.getString("suggested_category");
        OffsetDateTime answered = rs.getObject("answered_at", OffsetDateTime.class);
        return new GoalInquiry(rs.getString("id"), rs.getString("company_inn"), rs.getString("text"),
                GoalInquiry.Status.valueOf(rs.getString("status")), cat == null ? null : LoanGoal.valueOf(cat),
                rs.getString("employee_message"), rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                answered == null ? null : answered.toInstant());
    }
}
