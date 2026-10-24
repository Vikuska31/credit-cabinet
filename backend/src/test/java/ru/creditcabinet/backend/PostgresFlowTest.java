package ru.creditcabinet.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.creditcabinet.backend.application.ApplicationRepository;
import ru.creditcabinet.backend.application.ApplicationStatus;
import ru.creditcabinet.backend.application.LoanApplication;

import java.net.InetSocketAddress;
import java.net.Socket;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Тот же HTTP-сценарий, но на настоящем PostgreSQL (docker compose up -d db) + проверка, что состояние
 * читается из БД обратно без потерь. Если базы нет на localhost:5432, тест пропускается.
 */
@SpringBootTest
@EnabledIf("dbReachable")
class PostgresFlowTest extends HttpFlowTest {
    @Autowired ApplicationRepository repository;
    @Autowired JdbcClient jdbc;

    static boolean dbReachable() {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress("localhost", 5432), 500);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Test
    void stateSurvivesRoundTripThroughDatabase() throws Exception {
        String auth = "Bearer " + tokenForProfile("ooo-istoriya");
        String id = field(body(mvc.perform(post("/api/applications").header("Authorization", auth)).andReturn()), "id");
        mvc.perform(patch("/api/applications/" + id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"goals\":[\"EXPENSES\"],\"amount\":1200000,\"termMonths\":18,\"selectedKind\":\"LOWER_PAYMENT\",\"consent\":true}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/applications/" + id + "/documents/attach-suggested").header("Authorization", auth)).andExpect(status().isOk());
        mvc.perform(post("/api/applications/" + id + "/submit").header("Authorization", auth)).andExpect(status().isOk());

        LoanApplication loaded = repository.findById(id).orElseThrow();
        assertEquals(ApplicationStatus.APPROVED, loaded.status());
        assertEquals(30, loaded.finalOffer().termMonths());
        assertNotNull(loaded.decision());
        assertNotNull(loaded.bankDataSnapshot().inflows().totalRub());
        assertTrue(loaded.history().size() >= 3);
        assertEquals("APPROVED", jdbc.sql("SELECT status FROM applications WHERE id = :id").param("id", id).query(String.class).single());
        assertFalse(jdbc.sql("SELECT 1 FROM notifications WHERE application_id = :id").param("id", id).query(Integer.class).list().isEmpty(),
                "уведомления лежат в БД");
    }

    @Test
    void goalInquiryLifecycleInDatabase() throws Exception {
        String client = "Bearer " + tokenForProfile("ip-novichok");
        String inquiry = body(mvc.perform(post("/api/goal-inquiries").header("Authorization", client)
                .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Запустить новое направление\"}"))
                .andExpect(status().isOk()).andReturn());
        String id = field(inquiry, "id");
        String staff = "Bearer " + staffToken();
        mvc.perform(post("/api/staff/goal-inquiries/" + id + "/answer").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"EXPENSES\"}")).andExpect(status().isOk());
        String mine = body(mvc.perform(get("/api/goal-inquiries").header("Authorization", client)).andReturn());
        assertTrue(mine.contains("\"ANSWERED\"") && mine.contains("EXPENSES"));
    }
}
