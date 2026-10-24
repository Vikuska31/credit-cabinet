package ru.creditcabinet.backend.profiles;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import ru.creditcabinet.backend.application.CompanyDirectory;
import ru.creditcabinet.backend.application.DocumentCatalog;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.PasswordHasher;
import ru.creditcabinet.backend.auth.UserAccount;
import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.bank.BankDataSource;
import ru.creditcabinet.backend.domain.Company;
import ru.creditcabinet.backend.domain.CompanyForm;
import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentType;
import ru.creditcabinet.backend.domain.Role;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Читает демопрофили Вики (data/demo-profiles/profiles.json): клиенты и учётные записи, карточки компаний,
 * банковские сведения (запасной путь, если моки не подключены) и готовые документы.
 * Секция «employees» в файле необязательна; без неё берётся запасной сотрудник из настроек.
 */
public class ProfilesDirectory {

    public record DemoProfile(String id, String title, String login, String companyName) {}

    private record Entry(DemoProfile profile, String password, String fullName, Company company, BankData bankData,
                         List<DocumentRef> documents) {}

    private final Map<String, Entry> byInn = new HashMap<>();
    private final List<Entry> ordered = new ArrayList<>();
    private final List<UserAccount> employees = new ArrayList<>();

    public ProfilesDirectory(Path file, JsonMapper json, String fallbackStaffLogin, String fallbackStaffPassword, String fallbackStaffName) {
        JsonNode root;
        try {
            root = json.readTree(Files.readString(file));
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось прочитать файл демопрофилей: " + file.toAbsolutePath(), e);
        }
        JsonNode profiles = root.isArray() ? root : root.get("profiles");
        for (JsonNode p : profiles) {
            Entry e = parse(p);
            ordered.add(e);
            byInn.put(e.company().inn(), e);
        }
        JsonNode staff = root.isArray() ? null : root.get("employees");
        if (staff != null && staff.isArray() && !staff.isEmpty()) {
            for (JsonNode s : staff) {
                employees.add(new UserAccount(s.get("login").asString(), s.get("full_name").asString(), Role.EMPLOYEE, null,
                        PasswordHasher.hash(s.get("password").asString())));
            }
        } else {
            employees.add(new UserAccount(fallbackStaffLogin, fallbackStaffName, Role.EMPLOYEE, null, PasswordHasher.hash(fallbackStaffPassword)));
        }
    }

    private Entry parse(JsonNode p) {
        String id = p.get("id").asString();
        JsonNode u = p.get("user"), c = p.get("company");
        Company company = new Company(c.get("inn").asString(), "ИП".equals(c.get("form").asString()) ? CompanyForm.IP : CompanyForm.OOO,
                c.get("name").asString(), LocalDate.parse(c.get("registered_at").asString()),
                c.get("okved_code").asString(), c.get("okved_title").asString());
        BankData bank = BankDataMapper.fromJson(p.get("bank_data"));
        LocalDate loaded = bank.registry() != null && bank.registry().meta().asOf() != null ? bank.registry().meta().asOf() : LocalDate.now();
        List<DocumentRef> docs = new ArrayList<>();
        JsonNode arr = p.get("documents");
        if (arr != null && arr.isArray()) {
            int n = 0;
            for (JsonNode d : arr) {
                n++;
                String[] period = d.has("period") && !d.get("period").isNull() ? d.get("period").asString().split("\\.\\.") : new String[0];
                docs.add(new DocumentRef(id + "-doc-" + n, company.inn(), DocumentType.valueOf(d.get("type").asString().toUpperCase()),
                        d.get("title").asString(), period.length == 2 ? YearMonth.parse(period[0]) : null,
                        period.length == 2 ? YearMonth.parse(period[1]) : null,
                        d.has("version") ? d.get("version").asInt() : 1, loaded.atStartOfDay().toInstant(ZoneOffset.UTC)));
            }
        }
        return new Entry(new DemoProfile(id, p.get("title").asString(), u.get("login").asString(), company.name()),
                u.get("password").asString(), u.get("full_name").asString(), company, bank, docs);
    }

    public void registerAccounts(AuthService auth) {
        for (Entry e : ordered) {
            auth.register(new UserAccount(e.profile().login(), e.fullName(), Role.CLIENT, e.company().inn(), PasswordHasher.hash(e.password())));
        }
        employees.forEach(auth::register);
    }

    public List<DemoProfile> demoProfiles() { return ordered.stream().map(Entry::profile).toList(); }

    // Три роли разнесены по отдельным объектам, чтобы Spring не путал бины одного типа

    public CompanyDirectory companies() { return inn -> Optional.ofNullable(byInn.get(inn)).map(Entry::company); }

    public BankDataSource bankSource() {
        return inn -> {
            Entry e = byInn.get(inn);
            if (e == null) throw new BankDataSource.BankDataUnavailableException("Компания не найдена в источнике");
            return e.bankData();
        };
    }

    public DocumentCatalog documents() {
        return new DocumentCatalog() {
            @Override public List<DocumentRef> listByCompany(String inn) {
                Entry e = byInn.get(inn);
                return e == null ? List.of() : e.documents();
            }

            @Override public Optional<DocumentRef> find(String inn, String documentId) {
                return listByCompany(inn).stream().filter(d -> d.id().equals(documentId)).findFirst();
            }
        };
    }
}
