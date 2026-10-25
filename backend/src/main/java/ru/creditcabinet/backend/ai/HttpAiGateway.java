package ru.creditcabinet.backend.ai;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.time.Duration;
import java.util.concurrent.Semaphore;

public class HttpAiGateway implements AiGateway {
    private final RestClient client;
    private final JsonMapper json;
    private final Semaphore slots = new Semaphore(2);

    public HttpAiGateway(String url, String token, int timeoutMs, JsonMapper json) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));
        this.client = RestClient.builder().baseUrl(url).requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + token).build();
        this.json = json;
    }

    @Override public JsonNode post(String path, Object request) {
        if (!slots.tryAcquire()) throw new Unavailable("OVERLOADED");
        try {
            // Bound the response before deserializing, including untrusted dependency errors.
            return client.post().uri(path).body(request).exchange((req, response) -> {
                if (!response.getStatusCode().is2xxSuccessful()) throw new Unavailable("DEPENDENCY_UNAVAILABLE");
                byte[] bytes = response.getBody().readNBytes(65537);
                if (bytes.length == 0 || bytes.length > 65536) throw new Unavailable("INVALID_RESPONSE");
                try { return json.readTree(bytes); }
                catch (RuntimeException e) { throw new Unavailable("INVALID_RESPONSE"); }
            });
        } catch (Unavailable e) { throw e; }
        catch (RestClientException e) {
            Throwable cause = e;
            while (cause != null) {
                if (cause instanceof java.net.SocketTimeoutException) throw new Unavailable("TIMEOUT");
                cause = cause.getCause();
            }
            throw new Unavailable("DEPENDENCY_UNAVAILABLE");
        } finally { slots.release(); }
    }
}
