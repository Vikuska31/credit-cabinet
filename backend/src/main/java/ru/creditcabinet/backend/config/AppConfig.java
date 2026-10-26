package ru.creditcabinet.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;
import ru.creditcabinet.backend.application.ApplicationRepository;
import ru.creditcabinet.backend.application.ApplicationService;
import ru.creditcabinet.backend.application.InMemoryApplicationRepository;
import ru.creditcabinet.backend.application.CompanyDirectory;
import ru.creditcabinet.backend.application.DocumentCatalog;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.ProfileService;
import ru.creditcabinet.backend.bank.BankDataSource;
import ru.creditcabinet.backend.decision.DecisionEngine;
import ru.creditcabinet.backend.inquiry.GoalInquiryRepository;
import ru.creditcabinet.backend.inquiry.GoalInquiryService;
import ru.creditcabinet.backend.inquiry.InMemoryGoalInquiryRepository;
import ru.creditcabinet.backend.notification.InMemoryNotificationRepository;
import ru.creditcabinet.backend.notification.NotificationRepository;
import ru.creditcabinet.backend.notification.NotificationService;
import ru.creditcabinet.backend.profiles.HttpBankDataSource;
import ru.creditcabinet.backend.profiles.HttpDocumentCatalog;
import ru.creditcabinet.backend.profiles.ProfilesDirectory;
import ru.creditcabinet.backend.storage.JdbcApplicationRepository;
import ru.creditcabinet.backend.storage.JdbcGoalInquiryRepository;
import ru.creditcabinet.backend.storage.JdbcNotificationRepository;
import ru.creditcabinet.backend.tariff.CatalogService;
import ru.creditcabinet.backend.tariff.LoanCalculator;
import ru.creditcabinet.backend.tariff.Tariff;

import java.nio.file.Path;
import java.time.Clock;

/**
 * Собирает ядро (чистая Java) в Spring-бины. Внешние данные приходят из трёх мест:
 * профили, компании и аккаунты — из profiles.json; банковские сведения — из моков (MOCKS_URL),
 * а если адрес не задан, из того же файла; документы — из documents-service (DOCUMENTS_URL) или из файла.
 */
@Configuration
public class AppConfig {

    /**
     * APP_TODAY=2026-10-26 фиксирует «сегодня» для демо: сводки в демопрофилях покрывают июль–сентябрь,
     * а правило требует три последних полных месяца, поэтому с 1 ноября без этого демо ООО перестанет одобряться.
     */
    @Bean Clock clock(@Value("${app.today:}") String today) {
        if (today.isBlank()) return Clock.systemUTC();
        return Clock.fixed(java.time.LocalDate.parse(today).atTime(12, 0).toInstant(java.time.ZoneOffset.UTC), java.time.ZoneOffset.UTC);
    }

    @Bean JsonMapper jsonMapper() { return JsonMapper.builder().build(); }

    // ---------- Данные Вики ----------

    @Bean ProfilesDirectory profilesDirectory(JsonMapper json, AuthService auth,
                                              @Value("${app.profiles-file}") String file,
                                              @Value("${app.staff.login}") String staffLogin,
                                              @Value("${app.staff.password}") String staffPassword,
                                              @Value("${app.staff.full-name:Сотрудник банка (демо)}") String staffName) {
        ProfilesDirectory dir = new ProfilesDirectory(Path.of(file), json, staffLogin, staffPassword, staffName);
        dir.registerAccounts(auth);
        return dir;
    }

    @Bean CompanyDirectory companyDirectory(ProfilesDirectory dir) { return dir.companies(); }

    @Bean BankDataSource bankDataSource(ProfilesDirectory dir, @Value("${app.mocks-url:}") String mocksUrl) {
        return mocksUrl.isBlank() ? dir.bankSource() : new HttpBankDataSource(mocksUrl);
    }

    @Bean DocumentCatalog documentCatalog(ProfilesDirectory dir, @Value("${app.documents-url:}") String documentsUrl,
                                         @Value("${app.documents-token:}") String token) {
        return documentsUrl.isBlank() ? dir.documents() : new HttpDocumentCatalog(documentsUrl, token);
    }

    // ---------- Ядро ----------

    @Bean AuthService authService() { return new AuthService(); }

    @Bean LoanCalculator loanCalculator() { return new LoanCalculator(Tariff.DEMO); }

    @Bean CatalogService catalogService(LoanCalculator calculator) { return new CatalogService(calculator); }

    @Bean DecisionEngine decisionEngine(LoanCalculator calculator, Clock clock) { return new DecisionEngine(calculator, clock); }

    @Bean NotificationService notificationService(NotificationRepository repository, Clock clock) {
        return new NotificationService(repository, clock);
    }

    @Bean ApplicationService applicationService(ApplicationRepository repository, DocumentCatalog documents, CompanyDirectory companies,
                                                BankDataSource bank, LoanCalculator calculator, DecisionEngine engine,
                                                NotificationService notifications, Clock clock) {
        return new ApplicationService(repository, documents, companies, bank, calculator, engine, notifications, clock);
    }

    @Bean GoalInquiryService goalInquiryService(GoalInquiryRepository repository, NotificationService notifications, Clock clock) {
        return new GoalInquiryService(repository, notifications, clock);
    }

    @Bean ProfileService profileService(CompanyDirectory companies, BankDataSource bank) { return new ProfileService(companies, bank); }

    // ---------- Хранилище ----------

    @Configuration
    @ConditionalOnProperty(name = "app.storage", havingValue = "jdbc", matchIfMissing = true)
    static class JdbcStorage {
        @Bean ApplicationRepository applicationRepository(JdbcClient jdbc, JsonMapper json) { return new JdbcApplicationRepository(jdbc, json); }
        @Bean NotificationRepository notificationRepository(JdbcClient jdbc) { return new JdbcNotificationRepository(jdbc); }
        @Bean GoalInquiryRepository goalInquiryRepository(JdbcClient jdbc) { return new JdbcGoalInquiryRepository(jdbc); }
    }

    @Configuration
    @ConditionalOnProperty(name = "app.storage", havingValue = "memory")
    static class MemoryStorage {
        @Bean ApplicationRepository applicationRepository() { return new InMemoryApplicationRepository(); }
        @Bean NotificationRepository notificationRepository() { return new InMemoryNotificationRepository(); }
        @Bean GoalInquiryRepository goalInquiryRepository() { return new InMemoryGoalInquiryRepository(); }
    }
}
