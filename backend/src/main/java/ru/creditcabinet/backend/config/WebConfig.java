package ru.creditcabinet.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.common.ApiException;

import java.util.List;

/** Параметр {@link Principal} в контроллере подставляется из заголовка «Authorization: Bearer токен». */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final AuthService auth;
    private final String[] allowedOrigins;

    public WebConfig(AuthService auth, @Value("${app.cors-origins}") String origins) {
        this.auth = auth;
        this.allowedOrigins = java.util.Arrays.stream(origins.split(",")).map(String::trim).toArray(String[]::new);
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new HandlerMethodArgumentResolver() {
            @Override public boolean supportsParameter(MethodParameter p) { return p.getParameterType() == Principal.class; }

            @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav, NativeWebRequest request,
                                                    WebDataBinderFactory binder) {
                return auth.authenticate(bearerToken(request.getHeader("Authorization")));
            }
        });
    }

    public static String bearerToken(String header) {
        if (header == null || !header.startsWith("Bearer ")) throw ApiException.unauthorized("Требуется вход");
        return header.substring(7).trim();
    }

    /** Фронтенд (React/Vite) разрабатывается на другом порту. */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
