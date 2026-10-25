package ru.creditcabinet.backend.auth;

import ru.creditcabinet.backend.application.CompanyDirectory;
import ru.creditcabinet.backend.bank.BankDataSource;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.domain.Company;

import java.time.LocalDate;

/** «Профиль компании» по аватару: только данные своей компании, без доходов, документов и просрочек. */
public class ProfileService {
    public record CompanyProfile(String userFullName, Company company, LocalDate dataUpdatedAt, String note) {}

    private final CompanyDirectory companies;
    private final BankDataSource bankSource;

    public ProfileService(CompanyDirectory companies, BankDataSource bankSource) {
        this.companies = companies;
        this.bankSource = bankSource;
    }

    public CompanyProfile profile(Principal p) {
        p.requireClient();
        Company c = companies.findByInn(p.companyInn()).orElseThrow(() -> ApiException.notFound("Компания не найдена"));
        LocalDate updated = null;
        try {
            var registry = bankSource.fetch(c.inn()).registry();
            if (registry != null) updated = registry.meta().asOf();
        } catch (BankDataSource.BankDataUnavailableException ignored) {
            // Дату обновления просто не показываем; профиль при этом открывается
        }
        return new CompanyProfile(p.fullName(), c, updated, "Данные из карточки клиента банка (в демо синтетические)");
    }
}
