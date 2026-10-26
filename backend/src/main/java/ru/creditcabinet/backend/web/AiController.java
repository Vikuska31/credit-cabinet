package ru.creditcabinet.backend.web;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import ru.creditcabinet.backend.ai.AiContracts.*;
import ru.creditcabinet.backend.ai.AiFacade;
import ru.creditcabinet.backend.auth.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final AiFacade ai;
    public AiController(AiFacade ai) { this.ai=ai; }
    @GetMapping("/capabilities") public Map<String,Object> capabilities(Principal p) { return ai.capabilities(p); }
    @PostMapping("/goals/classify") public GoalResponse classify(Principal p,@Valid @RequestBody GoalRequest r) { return ai.classify(p,r); }
    @PostMapping("/assistant") public AssistantResponse assistant(Principal p,@Valid @RequestBody AssistantRequest r) { return ai.assistant(p,r); }
}
