package ru.creditcabinet.backend.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.common.ApiException.FieldError;
import java.util.List;

public final class AiContracts {
    private AiContracts() {}
    public enum Screen { HOME, CREDITS, WIZARD, APPLICATIONS, DOCUMENTS }
    public record Clarification(@NotBlank @Size(max=64) String questionCode, @NotBlank @Size(max=4000) String answer) {}
    public record GoalRequest(@NotBlank @Size(max=4000) String text, @Size(max=3) List<@NotNull @Valid Clarification> clarifications) {}
    public record Context(@NotNull Screen screen, @Size(max=64) String applicationId, @Size(max=64) String documentId) {}
    public record Message(@Pattern(regexp="user|assistant") @NotNull String role, @NotBlank @Size(max=4000) String content) {}
    public record AssistantRequest(@NotBlank @Size(max=4000) String message, @NotNull @Valid Context context, @Size(max=6) List<@NotNull @Valid Message> history) {}
    public record GoalEvidence(LoanGoal goal, String quote) {}
    public record GoalResponse(String schemaVersion, String status, List<LoanGoal> goals, String reasonCode, String questionCode,
                               String clarifyingQuestion, List<GoalEvidence> evidence, String fallbackReason) {}
    public record Entities(String purposeText, List<LoanGoal> goals, String amount, String currency, Integer termMonths) {
        public static Entities empty() { return new Entities(null, List.of(), null, null, null); }
    }
    public record Action(String type, String label, boolean requiresConfirmation, String applicationId, String documentId, String topic) {}
    public record AssistantResponse(String schemaVersion, String status, String intent, Entities entities, String questionCode,
                                    String clarifyingQuestion, String reply, List<Action> actions, List<FieldError> fieldErrors, String fallbackReason) {}
}
