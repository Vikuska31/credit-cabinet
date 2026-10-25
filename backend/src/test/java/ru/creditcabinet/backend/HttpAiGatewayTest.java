package ru.creditcabinet.backend;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import ru.creditcabinet.backend.ai.*;
import tools.jackson.databind.json.JsonMapper;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class HttpAiGatewayTest {
    @Test void transportAuthenticationBoundsAndErrors() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/ok",exchange->{
            assertEquals("Bearer service-test",exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] bytes="{\"status\":\"ok\"}".getBytes(StandardCharsets.UTF_8); exchange.sendResponseHeaders(200,bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.createContext("/large",exchange->{byte[] bytes=new byte[65537];exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});
        server.createContext("/error",exchange->{exchange.sendResponseHeaders(503,-1);exchange.close();}); server.start();
        try {
            var gateway=new HttpAiGateway("http://127.0.0.1:"+server.getAddress().getPort(),"service-test",1000,JsonMapper.builder().build());
            assertEquals("ok",gateway.post("/ok",Map.of()).get("status").asString());
            assertEquals("INVALID_RESPONSE",assertThrows(AiGateway.Unavailable.class,()->gateway.post("/large",Map.of())).reason);
            assertEquals("DEPENDENCY_UNAVAILABLE",assertThrows(AiGateway.Unavailable.class,()->gateway.post("/error",Map.of())).reason);
        } finally { server.stop(0); }
    }
}
