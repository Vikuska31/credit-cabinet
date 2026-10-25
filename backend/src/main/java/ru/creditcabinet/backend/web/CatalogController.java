package ru.creditcabinet.backend.web;

import org.springframework.web.bind.annotation.*;
import ru.creditcabinet.backend.application.DocumentCatalog;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.domain.DocumentRef;
import ru.creditcabinet.backend.domain.DocumentRequirements;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.tariff.CatalogService;
import ru.creditcabinet.backend.tariff.LoanOffer;
import ru.creditcabinet.backend.tariff.Tariff;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class CatalogController {
    public record GoalInfo(LoanGoal code, String title, String hint) {}
    public record PreviewRequest(Set<LoanGoal> goals, BigDecimal amount, Integer termMonths) {}
    public record PreviewResponse(List<String> hints, List<LoanOffer> offers, String disclaimer) {}

    private final CatalogService catalog;
    private final DocumentCatalog documents;

    public CatalogController(CatalogService catalog, DocumentCatalog documents) {
        this.catalog = catalog;
        this.documents = documents;
    }

    @GetMapping("/goals")
    public List<GoalInfo> goals(Principal p) {
        return catalog.goals().stream().map(g -> new GoalInfo(g, g.title(), g.hint())).toList();
    }

    @GetMapping("/tariff")
    public Tariff tariff(Principal p) { return catalog.tariff(); }

    /** Два предварительных расчёта. Процент одобрения не показываем. */
    @PostMapping("/offers/preview")
    public PreviewResponse preview(Principal p, @RequestBody PreviewRequest r) {
        p.requireClient();
        Set<LoanGoal> goals = r.goals() == null ? Set.of() : r.goals();
        return new PreviewResponse(catalog.hints(goals), catalog.preview(r.amount(), r.termMonths()),
                "Предварительный расчёт. Решение — после рассмотрения заявки");
    }

    /** Общая библиотека документов компании (загрузка — в documents-service). */
    @GetMapping("/documents")
    public List<DocumentRef> documents(Principal p) {
        p.requireClient();
        return documents.listByCompany(p.companyInn());
    }

    @GetMapping("/documents/already-on-file")
    public List<String> onFile(Principal p) { return DocumentRequirements.ON_FILE; }
}
