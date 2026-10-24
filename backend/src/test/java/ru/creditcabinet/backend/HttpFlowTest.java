package ru.creditcabinet.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Сквозной сценарий через HTTP: вход демопрофилем → черновик → отправка → решение → выдача. */
@SpringBootTest
@AutoConfigureMockMvc
class HttpFlowTest {
    @Autowired MockMvc mvc;

    private static String field(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(m.find(), "нет поля " + name + " в " + json);
        return m.group(1);
    }

    private String body(MvcResult r) throws Exception { return r.getResponse().getContentAsString(); }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/applications")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"demo.ip\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void oooHappyPathAndAccessRules() throws Exception {
        String token = field(body(mvc.perform(post("/api/auth/demo-login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"profileId\":\"ooo-istoriya\"}")).andExpect(status().isOk()).andReturn()), "token");
        String auth = "Bearer " + token;

        mvc.perform(post("/api/offers/preview").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"goals\":[\"EQUIPMENT\",\"ADVERTISING\"],\"amount\":1000000,\"termMonths\":24}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/offers/preview").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goals\":[\"GOODS\"],\"amount\":10,\"termMonths\":24}"))
                .andExpect(status().isBadRequest());

        String id = field(body(mvc.perform(post("/api/applications").header("Authorization", auth))
                .andExpect(status().isOk()).andReturn()), "id");
        mvc.perform(patch("/api/applications/" + id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"goals\":[\"EXPENSES\"],\"amount\":1500000,\"termMonths\":24,\"selectedKind\":\"REQUESTED\",\"consent\":true,\"step\":4}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/applications/" + id + "/documents/attach-suggested").header("Authorization", auth)).andExpect(status().isOk());

        MvcResult submitted = mvc.perform(post("/api/applications/" + id + "/submit").header("Authorization", auth))
                .andExpect(status().isOk()).andReturn();
        assertEquals("APPROVED", field(body(submitted), "status"));
        mvc.perform(post("/api/applications/" + id + "/submit").header("Authorization", auth)).andExpect(status().isOk());
        mvc.perform(get("/api/applications").header("Authorization", auth)).andExpect(status().isOk());

        mvc.perform(post("/api/applications/" + id + "/accept").header("Authorization", auth)).andExpect(status().isOk());
        assertEquals("ISSUED", field(body(mvc.perform(get("/api/applications/" + id).header("Authorization", auth)).andReturn()), "status"));
        mvc.perform(get("/api/applications/" + id + "/schedule").header("Authorization", auth)).andExpect(status().isOk());

        // чужой клиент не видит заявку
        String other = "Bearer " + field(body(mvc.perform(post("/api/auth/demo-login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"profileId\":\"ip-novichok\"}")).andReturn()), "token");
        mvc.perform(get("/api/applications/" + id).header("Authorization", other)).andExpect(status().isNotFound());
        // клиент не может действовать как сотрудник
        mvc.perform(post("/api/staff/applications/" + id + "/clarification-requests").header("Authorization", other)
                .contentType(MediaType.APPLICATION_JSON).content("{\"field\":\"x\",\"message\":\"y\"}")).andExpect(status().isForbidden());

        // сотрудник входит отдельно и видит заявку со сведениями проверок
        String staff = "Bearer " + field(body(mvc.perform(post("/api/auth/staff/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"employee\",\"password\":\"employee1234\"}")).andExpect(status().isOk()).andReturn()), "token");
        String view = body(mvc.perform(get("/api/applications/" + id).header("Authorization", staff)).andExpect(status().isOk()).andReturn());
        assertTrue(view.contains("bankData\":{"), "сотрудник видит bankData");
    }
}
