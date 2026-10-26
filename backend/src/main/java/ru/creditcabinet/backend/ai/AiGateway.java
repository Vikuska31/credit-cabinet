package ru.creditcabinet.backend.ai;

import tools.jackson.databind.JsonNode;

public interface AiGateway {
    JsonNode post(String path, Object request);
    class Unavailable extends RuntimeException {
        public final String reason;
        public Unavailable(String reason) { super(reason); this.reason = reason; }
    }
}
