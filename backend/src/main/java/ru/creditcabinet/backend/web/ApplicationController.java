package ru.creditcabinet.backend.web;

import org.springframework.web.bind.annotation.*;
import ru.creditcabinet.backend.application.*;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.domain.DocumentType;
import ru.creditcabinet.backend.tariff.ScheduleRow;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class ApplicationController {
    public record ClarificationAnswer(Set<String> attachedDocumentIds, BigDecimal monthlyIncomeRub, BigDecimal monthlyExpensesRub) {}
    public record ClarificationRequestBody(String field, DocumentType documentType, String message) {}

    private final ApplicationService apps;

    public ApplicationController(ApplicationService apps) { this.apps = apps; }

    @PostMapping("/applications")
    public ApplicationView create(Principal p) { return apps.createDraft(p); }

    @PatchMapping("/applications/{id}")
    public ApplicationView update(Principal p, @PathVariable String id, @RequestBody DraftUpdate u) {
        return apps.updateDraft(p, id, u);
    }

    @GetMapping("/applications")
    public List<ApplicationView> list(Principal p, @RequestParam(required = false) ApplicationStatus status) {
        return apps.list(p, status);
    }

    @GetMapping("/applications/{id}")
    public ApplicationView get(Principal p, @PathVariable String id) { return apps.get(p, id); }

    @GetMapping("/applications/{id}/documents")
    public List<DocumentCheck> documentChecks(Principal p, @PathVariable String id) { return apps.documentChecks(p, id); }

    @PostMapping("/applications/{id}/documents/attach-suggested")
    public ApplicationView attachSuggested(Principal p, @PathVariable String id) { return apps.attachSuggested(p, id); }

    @PostMapping("/applications/{id}/submit")
    public ApplicationView submit(Principal p, @PathVariable String id) { return apps.submit(p, id); }

    @PostMapping("/applications/{id}/clarification-response")
    public ApplicationView respond(Principal p, @PathVariable String id, @RequestBody ClarificationAnswer a) {
        return apps.respondToClarification(p, id, a.attachedDocumentIds(), a.monthlyIncomeRub(), a.monthlyExpensesRub());
    }

    @PostMapping("/applications/{id}/accept")
    public ApplicationView accept(Principal p, @PathVariable String id) { return apps.acceptOffer(p, id); }

    @PostMapping("/applications/{id}/decline")
    public ApplicationView decline(Principal p, @PathVariable String id) { return apps.declineOffer(p, id); }

    @PostMapping("/applications/{id}/retry-check")
    public ApplicationView retry(Principal p, @PathVariable String id) { return apps.retryCheck(p, id); }

    @GetMapping("/applications/{id}/schedule")
    public List<ScheduleRow> schedule(Principal p, @PathVariable String id) { return apps.schedule(p, id); }

    // --- сотрудник ---
    @PostMapping("/staff/applications/{id}/clarification-requests")
    public ApplicationView requestClarification(Principal p, @PathVariable String id, @RequestBody ClarificationRequestBody b) {
        return apps.requestClarification(p, id, b.field(), b.documentType(), b.message());
    }
}
