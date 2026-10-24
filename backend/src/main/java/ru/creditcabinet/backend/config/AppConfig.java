package ru.creditcabinet.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.creditcabinet.backend.application.ApplicationRepository;
import ru.creditcabinet.backend.application.ApplicationService;
import ru.creditcabinet.backend.application.InMemoryApplicationRepository;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.ProfileService;
import ru.creditcabinet.backend.decision.DecisionEngine;
import ru.creditcabinet.backend.demo.DemoSeed;
import ru.creditcabinet.backend.inquiry.GoalInquiryService;
import ru.creditcabinet.backend.notification.NotificationService;
import ru.creditcabinet.backend.tariff.CatalogService;
import ru.creditcabinet.backend.tariff.LoanCalculator;
import ru.creditcabinet.backend.tariff.Tariff;

import java.time.Clock;

/**
 * Собирает ядро (чистая Java) в Spring-бины.
 * DemoSeed пока играет три роли сразу: карточки компаний, банковские источники и библиотеку документов.
 * Когда подключим моки Вики и documents-service, здесь меняются только эти бины.
 */
@Configuration
public class AppConfig {

    @Bean Clock clock() { return Clock.systemUTC(); }

    @Bean DemoSeed demoSeed(AuthService auth) {
        DemoSeed seed = new DemoSeed();
        seed.registerAccounts(auth);
        return seed;
    }

    @Bean AuthService authService() { return new AuthService(); }

    @Bean LoanCalculator loanCalculator() { return new LoanCalculator(Tariff.DEMO); }

    @Bean CatalogService catalogService(LoanCalculator calculator) { return new CatalogService(calculator); }

    @Bean DecisionEngine decisionEngine(LoanCalculator calculator, Clock clock) { return new DecisionEngine(calculator, clock); }

    @Bean NotificationService notificationService(Clock clock) { return new NotificationService(clock); }

    @Bean ApplicationRepository applicationRepository() { return new InMemoryApplicationRepository(); }

    @Bean ApplicationService applicationService(ApplicationRepository repository, DemoSeed seed, LoanCalculator calculator,
                                                DecisionEngine engine, NotificationService notifications, Clock clock) {
        return new ApplicationService(repository, seed, seed, seed, calculator, engine, notifications, clock);
    }

    @Bean GoalInquiryService goalInquiryService(NotificationService notifications, Clock clock) {
        return new GoalInquiryService(notifications, clock);
    }

    @Bean ProfileService profileService(DemoSeed seed) { return new ProfileService(seed, seed); }
}
