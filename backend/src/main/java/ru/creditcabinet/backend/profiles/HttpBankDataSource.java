package ru.creditcabinet.backend.profiles;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.bank.BankDataSource;

import java.time.Duration;

/** Моки банковских источников Вики: GET {MOCKS_URL}/bank-data/{inn}. Любой сбой = источник недоступен (не отказ). */
public class HttpBankDataSource implements BankDataSource {
    private final RestClient client;

    public HttpBankDataSource(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @Override public BankData fetch(String inn) {
        try {
            JsonNode body = client.get().uri("/bank-data/{inn}", inn).retrieve().body(JsonNode.class);
            if (body == null) throw new BankDataUnavailableException("Пустой ответ источника");
            return BankDataMapper.fromJson(body);
        } catch (BankDataUnavailableException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new BankDataUnavailableException("Источник недоступен: " + e.getMessage());
        }
    }
}
