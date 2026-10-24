package ru.creditcabinet.backend.auth;

import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.domain.Role;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Вход по логину и паролю и выход. Клиентский и сотрудничий входы раздельны:
 * клиентский вход никогда не даёт банковские права.
 */
public class AuthService {
    public static final String BAD_CREDENTIALS = "Неверный логин или пароль. Попробуйте ещё раз";

    private final Map<String, UserAccount> accounts = new ConcurrentHashMap<>();
    private final Map<String, Principal> sessions = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public void register(UserAccount account) {
        accounts.put(account.login(), account);
    }

    /** Кнопка демопрофиля: тот же кабинет без пароля. Только для клиентских учёток. */
    public String loginDemoProfile(String login) {
        UserAccount account = login == null ? null : accounts.get(login);
        if (account == null || account.role() != Role.CLIENT) throw ApiException.notFound("Демопрофиль не найден");
        return openSession(account);
    }

    /** Возвращает токен сессии. Ответ при неверных данных одинаков для неизвестного логина и неверного пароля. */
    public String login(String login, String password, Role expectedRole) {
        UserAccount account = login == null ? null : accounts.get(login);
        boolean ok = account != null && password != null && account.role() == expectedRole
                && PasswordHasher.matches(password, account.passwordHash());
        if (!ok) throw ApiException.unauthorized(BAD_CREDENTIALS);
        return openSession(account);
    }

    private String openSession(UserAccount account) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        sessions.put(token, new Principal(account.login(), account.fullName(), account.role(), account.companyInn()));
        return token;
    }

    public Principal authenticate(String token) {
        Principal p = token == null ? null : sessions.get(token);
        if (p == null) throw ApiException.unauthorized("Требуется вход");
        return p;
    }

    public void logout(String token) {
        if (token != null) sessions.remove(token);
    }
}
