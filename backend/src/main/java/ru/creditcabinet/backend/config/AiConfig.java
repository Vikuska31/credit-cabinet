package ru.creditcabinet.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.creditcabinet.backend.ai.*;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class AiConfig {
    @Bean AiGateway aiGateway(@Value("${app.ai.enabled}") boolean enabled,
                             @Value("${app.ai.url}") String url,
                             @Value("${app.ai.token}") String token,
                             @Value("${app.ai.timeout-ms}") int timeout, JsonMapper json) {
        if (!enabled) return (path, request) -> { throw new AiGateway.Unavailable("DISABLED"); };
        if (token.isBlank()) return (path, request) -> { throw new AiGateway.Unavailable("DEPENDENCY_UNAVAILABLE"); };
        return new HttpAiGateway(url, token, timeout, json);
    }
}
