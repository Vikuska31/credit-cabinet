package ru.creditcabinet.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.creditcabinet.backend.ai.*;
import ru.creditcabinet.backend.ai.AiContracts.*;
import ru.creditcabinet.backend.application.*;
import ru.creditcabinet.backend.auth.*;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.decision.DecisionEngine;
import ru.creditcabinet.backend.demo.DemoSeed;
import ru.creditcabinet.backend.domain.*;
import ru.creditcabinet.backend.notification.*;
import ru.creditcabinet.backend.tariff.*;
import tools.jackson.databind.json.JsonMapper;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class AiFacadeTest {
    final JsonMapper json=JsonMapper.builder().build();
    DemoSeed seed; ApplicationService apps; CatalogService catalog; Principal client,other,staff;
    @BeforeEach void setup() {
        seed=new DemoSeed(); var auth=new AuthService(); seed.registerAccounts(auth);
        client=auth.authenticate(auth.loginDemoProfile("demo.ooo")); other=auth.authenticate(auth.loginDemoProfile("demo.ip"));
        staff=auth.authenticate(auth.login("employee","employee1234",Role.EMPLOYEE));
        var clock=Clock.fixed(Instant.parse("2026-10-25T12:00:00Z"),ZoneOffset.UTC); var calc=new LoanCalculator(Tariff.DEMO);
        apps=new ApplicationService(new InMemoryApplicationRepository(),seed,seed,seed,calc,new DecisionEngine(calc,clock),new NotificationService(new InMemoryNotificationRepository(),clock),clock);
        catalog=new CatalogService(calc);
    }
    AiFacade facade(String response) { return new AiFacade((path,r)->json.readTree(response),apps,seed,catalog,json,true); }
    String goal() { return """
        {"schemaVersion":"1","status":"CLASSIFIED","businessUse":"BUSINESS","goals":["EQUIPMENT","ADVERTISING"],"reasonCode":"BUSINESS_PURPOSE","questionCode":null,"evidence":[{"goal":"EQUIPMENT","quote":"станок"},{"goal":"ADVERTISING","quote":"реклама"}],"fallbackReason":null}
        """; }
    String assistant(String intent,String ref) { return """
        {"schemaVersion":"1","status":"READY","businessUse":"NOT_APPLICABLE","intent":"%s","entities":{"purposeText":null,"goals":[],"amount":null,"currency":null,"termMonths":null},"questionCode":null,"explanationTopic":null,"targetRef":%s,"evidence":[],"fallbackReason":null}
        """.formatted(intent,ref==null?"null":"\""+ref+"\""); }
    AssistantRequest request(String app) { return new AssistantRequest("Продолжить черновик",new Context(Screen.HOME,app,null),List.of()); }
    @Test void multiGoalsAreSuggestionsAndUseExistingDocumentRules() {
        var result=facade(goal()).classify(client,new GoalRequest("станок и реклама для мастерской",List.of()));
        assertEquals("CLASSIFIED",result.status()); assertEquals(2,result.goals().size()); assertTrue(apps.list(client,null).isEmpty());
        var draft=apps.createDraft(client);
        apps.updateDraft(client,draft.id(),new DraftUpdate(new HashSet<>(result.goals()),"станок и реклама",null,new BigDecimal("1000000"),24,null,null,null,null,false,1));
        assertTrue(apps.documentChecks(client,draft.id()).stream().anyMatch(c->c.type()==DocumentType.PURCHASE_DOCUMENT && c.blocksSubmit()));
    }
    @Test void rejectsForbiddenFieldsCategoriesAndPersonalPurposes() {
        for(String response:List.of(goal().replace("EQUIPMENT","OTHER"),goal().replace("\"fallbackReason\":null","\"fallbackReason\":null,\"actions\":[\"SUBMIT\"]"),goal().replace("станок\"}","выдумано\"}")))
            assertEquals("UNAVAILABLE",facade(response).classify(client,new GoalRequest("станок и реклама",List.of())).status());
        assertEquals("UNAVAILABLE",facade(goal()).classify(client,new GoalRequest("станок и реклама для себя",List.of())).status());
    }
    @Test void ownerAndStatusVerifiedWithoutMutation() {
        var draft=apps.createDraft(client); int events=draft.history().size();
        var result=facade(assistant("CONTINUE_DRAFT","app-0")).assistant(client,request(draft.id()));
        assertEquals("READY",result.status()); assertEquals(draft.id(),result.actions().getFirst().applicationId());
        assertEquals(events,apps.get(client,draft.id()).history().size()); assertEquals(1,apps.list(client,null).size());
        assertEquals(404,assertThrows(ApiException.class,()->facade(assistant("OPEN_APPLICATION",null)).assistant(other,request(draft.id()))).status());
        assertEquals(403,assertThrows(ApiException.class,()->facade(goal()).classify(staff,new GoalRequest("станок",List.of()))).status());
    }
    @Test void multipleDraftsOfferExplicitChoice() {
        apps.createDraft(client); apps.createDraft(client);
        var result=facade(assistant("CONTINUE_DRAFT",null)).assistant(client,request(null));
        assertEquals("NEEDS_CLARIFICATION",result.status()); assertEquals("SELECT_APPLICATION",result.questionCode()); assertEquals(2,result.actions().size());
    }
    @Test void unknownActionTargetAndUnprovenNumbersAreRejected() {
        for(String response:List.of(assistant("SUBMIT",null),assistant("OPEN_APPLICATION","foreign"),assistant("START_SELECTION",null).replace("\"amount\":null","\"amount\":\"1500000.00\"")))
            assertEquals("UNAVAILABLE",facade(response).assistant(client,request(null)).status());
    }
    @Test void disabledAndFailureHaveNoSideEffects() {
        var count=new AtomicInteger();
        var ai=new AiFacade((path,r)->{count.incrementAndGet();throw new AiGateway.Unavailable("TIMEOUT");},apps,seed,catalog,json,false);
        assertEquals("DISABLED",ai.assistant(client,request(null)).fallbackReason()); assertEquals(0,count.get());
        assertEquals("DISABLED",ai.classify(client,new GoalRequest("сырьё",List.of())).fallbackReason());
        assertEquals(0,count.get());
        var enabledAi=new AiFacade((path,r)->{throw new AiGateway.Unavailable("TIMEOUT");},apps,seed,catalog,json,true);
        assertEquals("TIMEOUT",enabledAi.classify(client,new GoalRequest("сырьё",List.of())).fallbackReason());
        assertTrue(apps.list(client,null).isEmpty());
    }
    @Test void changingOtherTextInvalidatesOldConfirmation() {
        var d=apps.createDraft(client);
        apps.updateDraft(client,d.id(),new DraftUpdate(Set.of(LoanGoal.OTHER),"станок",LoanGoal.EQUIPMENT,null,null,null,null,null,null,null,null));
        var updated=apps.updateDraft(client,d.id(),new DraftUpdate(null,"неизвестная новая цель",null,null,null,null,null,null,null,null,null));
        assertNull(updated.otherGoalCategory());
    }
}
