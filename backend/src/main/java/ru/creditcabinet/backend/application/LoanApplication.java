package ru.creditcabinet.backend.application;

import ru.creditcabinet.backend.bank.BankData;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.decision.Decision;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.tariff.LoanOffer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Заявка: черновик и состояние рассмотрения в одной сущности. Меняется только через {@link ApplicationService}. */
public class LoanApplication {
    private final String id;
    private final long number;
    private final String companyInn;
    private final Instant createdAt;

    private ApplicationStatus status = ApplicationStatus.DRAFT;
    private int step = 1;

    // Параметры, введённые клиентом
    private Set<LoanGoal> goals = EnumSet.noneOf(LoanGoal.class);
    private String otherGoalText;
    private LoanGoal otherGoalCategory;
    private BigDecimal amount;
    private Integer termMonths;
    private LoanOffer.Kind selectedKind = LoanOffer.Kind.REQUESTED;
    private BigDecimal monthlyIncomeRub;
    private BigDecimal monthlyExpensesRub;
    private final Set<String> attachedDocumentIds = new LinkedHashSet<>();
    private boolean consent;

    // Отправленное и результат
    private LoanOffer submittedOffer;
    private Instant submittedAt;
    private BankData bankDataSnapshot;
    private Decision decision;
    private LoanOffer finalOffer;
    private Instant issuedAt;
    private List<Decision.ClarificationRequest> openRequests = List.of();
    private final List<HistoryEvent> history = new ArrayList<>();

    LoanApplication(String id, long number, String companyInn, Instant createdAt) {
        this.id = id;
        this.number = number;
        this.companyInn = companyInn;
        this.createdAt = createdAt;
    }

    void transitionTo(ApplicationStatus next) {
        if (!status.next().contains(next)) {
            throw ApiException.conflict("invalid_transition",
                    "Из состояния «%s» нельзя перейти в «%s»".formatted(status.title(), next.title()));
        }
        status = next;
    }

    void addHistory(Instant at, String actor, String type, String message) {
        history.add(new HistoryEvent(at, actor, type, message));
    }

    /** Цели с подставленной подтверждённой категорией вместо «Другое». */
    public Set<LoanGoal> effectiveGoals() {
        Set<LoanGoal> result = EnumSet.noneOf(LoanGoal.class);
        for (LoanGoal g : goals) {
            if (g == LoanGoal.OTHER) {
                if (otherGoalCategory != null) result.add(otherGoalCategory);
            } else {
                result.add(g);
            }
        }
        return result;
    }

    public String id() { return id; }
    public long number() { return number; }
    public String companyInn() { return companyInn; }
    public Instant createdAt() { return createdAt; }
    public ApplicationStatus status() { return status; }
    public int step() { return step; }
    public Set<LoanGoal> goals() { return goals; }
    public String otherGoalText() { return otherGoalText; }
    public LoanGoal otherGoalCategory() { return otherGoalCategory; }
    public BigDecimal amount() { return amount; }
    public Integer termMonths() { return termMonths; }
    public LoanOffer.Kind selectedKind() { return selectedKind; }
    public BigDecimal monthlyIncomeRub() { return monthlyIncomeRub; }
    public BigDecimal monthlyExpensesRub() { return monthlyExpensesRub; }
    public Set<String> attachedDocumentIds() { return attachedDocumentIds; }
    public boolean consent() { return consent; }
    public LoanOffer submittedOffer() { return submittedOffer; }
    public Instant submittedAt() { return submittedAt; }
    public BankData bankDataSnapshot() { return bankDataSnapshot; }
    public Decision decision() { return decision; }
    public LoanOffer finalOffer() { return finalOffer; }
    public Instant issuedAt() { return issuedAt; }
    public List<Decision.ClarificationRequest> openRequests() { return openRequests; }
    public List<HistoryEvent> history() { return List.copyOf(history); }

    void setStep(int step) { this.step = step; }
    void setGoals(Set<LoanGoal> goals) { this.goals = goals.isEmpty() ? EnumSet.noneOf(LoanGoal.class) : EnumSet.copyOf(goals); }
    void setOtherGoalText(String t) { this.otherGoalText = t; }
    void setOtherGoalCategory(LoanGoal c) { this.otherGoalCategory = c; }
    void setAmount(BigDecimal a) { this.amount = a; }
    void setTermMonths(Integer t) { this.termMonths = t; }
    void setSelectedKind(LoanOffer.Kind k) { this.selectedKind = k; }
    void setMonthlyIncomeRub(BigDecimal v) { this.monthlyIncomeRub = v; }
    void setMonthlyExpensesRub(BigDecimal v) { this.monthlyExpensesRub = v; }
    void setConsent(boolean c) { this.consent = c; }
    void setSubmittedOffer(LoanOffer o) { this.submittedOffer = o; }
    void setSubmittedAt(Instant t) { this.submittedAt = t; }
    void setBankDataSnapshot(BankData d) { this.bankDataSnapshot = d; }
    void setDecision(Decision d) { this.decision = d; }
    void setFinalOffer(LoanOffer o) { this.finalOffer = o; }
    void setIssuedAt(Instant t) { this.issuedAt = t; }
    void setOpenRequests(List<Decision.ClarificationRequest> r) { this.openRequests = List.copyOf(r); }
}
