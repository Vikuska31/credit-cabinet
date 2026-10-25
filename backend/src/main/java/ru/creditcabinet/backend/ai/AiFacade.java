package ru.creditcabinet.backend.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import ru.creditcabinet.backend.ai.AiContracts.*;
import ru.creditcabinet.backend.application.*;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.common.ApiException.FieldError;
import ru.creditcabinet.backend.domain.*;
import ru.creditcabinet.backend.tariff.CatalogService;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.*;

@Service
public class AiFacade {
    private final AiGateway gateway;
    private final ApplicationService apps;
    private final DocumentCatalog documents;
    private final CatalogService catalog;
    private final JsonMapper json;
    private final boolean enabled;
    private static final Set<String> FALLBACKS = Set.of("DISABLED","DEPENDENCY_UNAVAILABLE","TIMEOUT","INVALID_RESPONSE","OVERLOADED");
    private static final Set<String> INTENTS = Set.of("START_SELECTION","CONTINUE_DRAFT","OPEN_APPLICATION","SHOW_DOCUMENT","EXPLAIN_TERMS","UNKNOWN","OUT_OF_SCOPE");
    private static final Set<String> TOPICS = Set.of("RATE","PAYMENT","FEE","DOCUMENTS","PREVIEW");
    private static final Map<String,String> QUESTIONS = Map.of(
            "SPECIFY_BUSINESS_USE", "Для какой задачи бизнеса нужны деньги?",
            "SPECIFY_PURPOSE", "На что именно вы хотите направить кредит?",
            "SPECIFY_AMOUNT", "Какая сумма в рублях вам нужна?",
            "SPECIFY_TERM", "На какой срок в месяцах вы хотите взять кредит?",
            "SPECIFY_CURRENCY", "Укажите сумму в рублях: кабинет работает с рублёвыми кредитами.",
            "EXCLUDE_PERSONAL_PURPOSE", "Уточните бизнес-цель и исключите личные расходы из запроса.",
            "SELECT_APPLICATION", "Выберите нужную заявку.",
            "SELECT_DOCUMENT", "Выберите нужный документ.");

    public AiFacade(AiGateway gateway, ApplicationService apps, DocumentCatalog documents, CatalogService catalog,
                    JsonMapper json, @Value("${app.ai.enabled}") boolean enabled) {
        this.gateway=gateway; this.apps=apps; this.documents=documents; this.catalog=catalog; this.json=json; this.enabled=enabled;
    }

    public Map<String,Object> capabilities(Principal p) {
        p.requireClient();
        return Map.of("schemaVersion","1", "enabled",enabled, "features",Map.of("goalClassification",enabled,"assistant",enabled));
    }

    public GoalResponse classify(Principal p, GoalRequest r) {
        p.requireClient();
        if (r.clarifications()!=null && r.clarifications().stream().anyMatch(c -> !QUESTIONS.containsKey(c.questionCode())))
            throw ApiException.validation("clarifications", "Неизвестный уточняющий вопрос");
        if (!enabled) return goalUnavailable("DISABLED");
        try {
            JsonNode n = gateway.post("/v1/goals/classify", Map.of("text",r.text(),"clarifications",r.clarifications()==null?List.of():r.clarifications()));
            keys(n,"schemaVersion,status,businessUse,goals,reasonCode,questionCode,evidence,fallbackReason");
            version(n);
            String status=text(n,"status");
            if (status.equals("UNAVAILABLE")) return goalUnavailable(fallback(n));
            require(Set.of("BUSINESS","PERSONAL","MIXED","UNCLEAR","NOT_APPLICABLE").contains(text(n,"businessUse")));
            require(Set.of("CLASSIFIED","NEEDS_CLARIFICATION","NON_BUSINESS","UNSUPPORTED").contains(status));
            List<LoanGoal> goals=goals(n.get("goals"));
            String q=question(n,status);
            String reason=text(n,"reasonCode");
            require(Set.of("BUSINESS_PURPOSE","PERSONAL_PURPOSE","AMBIGUOUS_PURPOSE","OUTSIDE_TAXONOMY").contains(reason));
            require(!status.equals("CLASSIFIED") || ("BUSINESS".equals(text(n,"businessUse")) && !goals.isEmpty()));
            require(status.equals("CLASSIFIED") || goals.isEmpty());
            String source=r.text()+"\n"+(r.clarifications()==null?"":String.join("\n",r.clarifications().stream().map(Clarification::answer).toList()));
            require(!status.equals("CLASSIFIED") || !personal(source));
            var evidence=new ArrayList<GoalEvidence>();
            require(n.get("evidence").isArray() && n.get("evidence").size()<=5);
            for (JsonNode item:n.get("evidence")) {
                keys(item,"goal,quote");
                var goal=LoanGoal.valueOf(text(item,"goal"));
                String quote=text(item,"quote");
                require(!quote.isBlank() && quote.length()<=500 && source.contains(quote) && goals.contains(goal));
                evidence.add(new GoalEvidence(goal,quote));
            }
            require(new HashSet<>(evidence.stream().map(GoalEvidence::goal).toList()).equals(new HashSet<>(goals)));
            return new GoalResponse("1",status,goals,reason,q,(q==null?null:QUESTIONS.get(q)),evidence,null);
        } catch (AiGateway.Unavailable e) { return goalUnavailable(e.reason); }
        catch (RuntimeException e) { return goalUnavailable("INVALID_RESPONSE"); }
    }

    public AssistantResponse assistant(Principal p, AssistantRequest r) {
        p.requireClient();
        // Authorization happens before contacting any dependency, even when AI is disabled.
        ApplicationView selected=r.context().applicationId()==null?null:apps.get(p,r.context().applicationId());
        DocumentRef selectedDoc=r.context().documentId()==null?null:documents.find(p.companyInn(),r.context().documentId())
                .orElseThrow(() -> ApiException.notFound("Документ не найден"));
        if (!enabled) return unavailable("DISABLED");
        try {
            List<ApplicationView> applicationList=selected==null?apps.list(p,null).stream().limit(30).toList():List.of(selected);
            List<DocumentRef> documentList=selectedDoc==null?documents.listByCompany(p.companyInn()).stream().limit(30).toList():List.of(selectedDoc);
            Map<String,ApplicationView> appRefs=new LinkedHashMap<>();
            Map<String,DocumentRef> docRefs=new LinkedHashMap<>();
            applicationList.forEach(a -> appRefs.put("app-"+appRefs.size(),a));
            documentList.forEach(d -> docRefs.put("doc-"+docRefs.size(),d));
            var context=Map.of("screen",r.context().screen().name(),
                    "applications",appRefs.entrySet().stream().map(e -> Map.of("ref",e.getKey(),"number",e.getValue().number(),"status",e.getValue().status().name())).toList(),
                    "documents",docRefs.entrySet().stream().map(e -> Map.of("ref",e.getKey(),"type",e.getValue().type().name(),"title",e.getValue().title().substring(0,Math.min(300,e.getValue().title().length())))).toList());
            JsonNode n=gateway.post("/v1/assistant",Map.of("message",r.message(),"history",r.history()==null?List.of():r.history(),"context",context));
            keys(n,"schemaVersion,status,businessUse,intent,entities,questionCode,explanationTopic,targetRef,evidence,fallbackReason");
            version(n);
            String status=text(n,"status");
            if (status.equals("UNAVAILABLE")) return unavailable(fallback(n));
            require(Set.of("READY","NEEDS_CLARIFICATION","NON_BUSINESS","UNSUPPORTED").contains(status));
            String intent=text(n,"intent"); require(INTENTS.contains(intent));
            String business=text(n,"businessUse");
            require(Set.of("BUSINESS","PERSONAL","MIXED","UNCLEAR","NOT_APPLICABLE").contains(business));
            require(!status.equals("READY") || !Set.of("PERSONAL","MIXED","UNCLEAR").contains(business));
            String q=question(n,status), topic=optional(n,"explanationTopic"), ref=optional(n,"targetRef");
            require(topic==null || TOPICS.contains(topic));
            require(intent.equals("EXPLAIN_TERMS") == (topic!=null));
            require(ref==null || appRefs.containsKey(ref) || docRefs.containsKey(ref));
            JsonNode en=n.get("entities"); keys(en,"purposeText,goals,amount,currency,termMonths");
            String amount=optional(en,"amount"),currency=optional(en,"currency"),purpose=optional(en,"purposeText");
            List<LoanGoal> gs=goals(en.get("goals"));
            Integer term=en.get("termMonths")==null || en.get("termMonths").isNull()?null:en.get("termMonths").isIntegralNumber()?en.get("termMonths").asInt():-1;
            require(term==null || (term>0 && term<=1200));
            require(amount==null || amount.matches("\\d{1,12}(\\.\\d{1,2})?"));
            require(currency==null || Set.of("RUB","USD","EUR","OTHER").contains(currency));
            require((purpose==null || purpose.length()<=1000) && ((purpose==null && gs.isEmpty()) || text(n,"businessUse").equals("BUSINESS")));
            String source=(r.history()==null?"":String.join("\n",r.history().stream().filter(h->h.role().equals("user")).map(Message::content).toList()))+"\n"+r.message();
            require(!status.equals("READY") || !intent.equals("START_SELECTION") || !personal(source));
            require(n.get("evidence").isArray() && n.get("evidence").size()<=10);
            Map<String,List<String>> proof=new HashMap<>();
            for (JsonNode item:n.get("evidence")) {
                keys(item,"field,quote"); String field=text(item,"field"),quote=text(item,"quote");
                require(Set.of("purposeText","goals","amount","termMonths").contains(field) && !quote.isBlank() && quote.length()<=500 && source.contains(quote));
                proof.computeIfAbsent(field,k->new ArrayList<>()).add(quote);
            }
            require(purpose==null || proof.containsKey("purposeText")); require(gs.isEmpty() || proof.containsKey("goals"));
            require(amount==null || proof.getOrDefault("amount",List.of()).stream().anyMatch(s -> number(s,false).map(v -> v.compareTo(new BigDecimal(amount))==0).orElse(false)));
            require(term==null || proof.getOrDefault("termMonths",List.of()).stream().anyMatch(s -> number(s,true).map(v -> v.compareTo(BigDecimal.valueOf(term))==0).orElse(false)));
            if (status.equals("NON_BUSINESS") || status.equals("UNSUPPORTED")) {
                require(purpose==null && gs.isEmpty() && amount==null && term==null);
                return response(status,intent,Entities.empty(),q,status.equals("NON_BUSINESS")?"Помощник предназначен для бизнес-целей. Уточните назначение средств.":"Выберите действие в кабинете вручную.",List.of(),List.of());
            }
            var errors=new ArrayList<FieldError>(); var t=catalog.tariff();
            if (amount!=null && (new BigDecimal(amount).compareTo(t.minAmount())<0 || new BigDecimal(amount).compareTo(t.maxAmount())>0)) errors.add(new FieldError("amount","Допустимая сумма: "+t.minAmount()+"–"+t.maxAmount()+" ₽"));
            if (term!=null && (term<t.minTermMonths() || term>t.maxTermMonths())) errors.add(new FieldError("termMonths","Допустимый срок: "+t.minTermMonths()+"–"+t.maxTermMonths()+" месяцев"));
            if (currency!=null && !currency.equals("RUB")) { status="NEEDS_CLARIFICATION"; q="SPECIFY_CURRENCY"; }
            var entities=new Entities(purpose,gs,amount,currency,term);
            List<Action> actions=new ArrayList<>();
            if (status.equals("READY") && errors.isEmpty()) {
                switch (intent) {
                    case "START_SELECTION" -> actions.add(action(intent,"Начать подбор",null,null,null));
                    case "CONTINUE_DRAFT", "OPEN_APPLICATION" -> {
                        var candidates=appRefs.entrySet().stream().filter(e -> !intent.equals("CONTINUE_DRAFT") || e.getValue().status()==ApplicationStatus.DRAFT).filter(e -> ref==null || e.getKey().equals(ref)).toList();
                        for (var candidate:candidates) {
                            // Reload through ApplicationService to re-check ownership and current state.
                            var current=apps.get(p,candidate.getValue().id());
                            if (!intent.equals("CONTINUE_DRAFT") || current.status()==ApplicationStatus.DRAFT)
                                actions.add(action(intent,(intent.equals("CONTINUE_DRAFT")?"Продолжить":"Открыть")+" заявку №"+current.number(),current.id(),null,null));
                        }
                        if (actions.size()>1) { status="NEEDS_CLARIFICATION"; q="SELECT_APPLICATION"; }
                    }
                    case "SHOW_DOCUMENT" -> {
                        Set<String> currentDocumentIds = new HashSet<>(documents.listByCompany(p.companyInn()).stream().map(DocumentRef::id).toList());
                        for (var candidate:docRefs.entrySet()) if (ref==null || candidate.getKey().equals(ref)) {
                            var d=candidate.getValue();
                            if (currentDocumentIds.contains(d.id())) actions.add(action(intent,d.title(),null,d.id(),null));
                        }
                        if (actions.size()>1) { status="NEEDS_CLARIFICATION"; q="SELECT_DOCUMENT"; }
                    }
                    case "EXPLAIN_TERMS" -> actions.add(action(intent,"Показать пояснение",null,null,topic));
                    default -> { }
                }
            }
            String reply=q!=null?(q==null?null:QUESTIONS.get(q)):intent.equals("EXPLAIN_TERMS")?explain(topic,selected):"Проверьте параметры и выберите действие. Изменения применяются только после вашего подтверждения.";
            if (!errors.isEmpty()) reply="Проверьте сумму и срок: они выходят за диапазоны программы.";
            if (actions.isEmpty() && status.equals("READY") && !intent.equals("START_SELECTION")) reply="Подходящий объект не найден. Вы можете открыть нужный раздел вручную.";
            return response(status,intent,entities,q,reply,actions,errors);
        } catch (AiGateway.Unavailable e) { return unavailable(e.reason); }
        catch (RuntimeException e) { return unavailable("INVALID_RESPONSE"); }
    }

    private String explain(String topic, ApplicationView a) {
        var t=catalog.tariff();
        return switch (topic) {
            case "RATE" -> "Демонстрационная ставка: "+t.annualRatePercent()+"% годовых. Окончательные условия определяются после рассмотрения заявки.";
            case "FEE" -> "Разовая комиссия: "+t.upfrontFeePercent()+"% от суммы. Серверный расчёт общей выплаты включает комиссию.";
            case "PAYMENT" -> a!=null && a.finalOffer()!=null?"Платёж по предложению: "+a.finalOffer().monthlyPayment()+" ₽ в месяц.":"Для расчёта платежа укажите сумму и срок в разделе «Кредиты».";
            case "DOCUMENTS" -> "Комплект зависит от цели и суммы. Точный перечень доступен на шаге «Документы» вашей заявки.";
            default -> "Предварительный расчёт не означает одобрение. Решение принимает банковская логика после проверки заявки.";
        };
    }
    private Action action(String type,String label,String app,String doc,String topic) { return new Action(type,label,true,app,doc,topic); }
    private AssistantResponse response(String status,String intent,Entities e,String q,String reply,List<Action> actions,List<FieldError> errors) { return new AssistantResponse("1",status,intent,e,q,(q==null?null:QUESTIONS.get(q)),reply,actions,errors,null); }
    private GoalResponse goalUnavailable(String reason) { return new GoalResponse("1","UNAVAILABLE",List.of(),"AI_UNAVAILABLE",null,null,List.of(),safeFallback(reason)); }
    private AssistantResponse unavailable(String reason) { return new AssistantResponse("1","UNAVAILABLE","UNKNOWN",Entities.empty(),null,null,"Помощник сейчас недоступен. Продолжите оформление вручную.",List.of(),List.of(),safeFallback(reason)); }
    private String safeFallback(String reason) { return FALLBACKS.contains(reason)?reason:"INVALID_RESPONSE"; }
    private String fallback(JsonNode n) { return safeFallback(text(n,"fallbackReason")); }
    private void version(JsonNode n) { require(text(n,"schemaVersion").equals("1")); }
    private String question(JsonNode n,String status) { String q=optional(n,"questionCode"); require(q==null || QUESTIONS.containsKey(q)); require(status.equals("NEEDS_CLARIFICATION")== (q!=null)); return q; }
    private List<LoanGoal> goals(JsonNode n) { require(n!=null && n.isArray() && n.size()<=5); var result=new ArrayList<LoanGoal>(); for(JsonNode g:n) { require(g.isTextual()); var goal=LoanGoal.valueOf(g.asString()); require(goal!=LoanGoal.OTHER && !result.contains(goal)); result.add(goal); } return result; }
    private void keys(JsonNode n,String allowed) { require(n!=null && n.isObject()); var names=Set.of(allowed.split(",")); require(names.equals(json.convertValue(n,Map.class).keySet())); }
    private String text(JsonNode n,String key) { var v=n.get(key); require(v!=null && v.isTextual()); return v.asString(); }
    private String optional(JsonNode n,String key) { var v=n.get(key); return v==null || v.isNull()?null:text(n,key); }
    private void require(boolean valid) { if(!valid) throw new IllegalArgumentException("Invalid AI response"); }
    private boolean personal(String source) { return Pattern.compile("для\\s+(?:себя|личного\\s+пользования|личного\\s+проживания)|на\\s+(?:свой\\s+)?отпуск|погасить\\s+личный\\s+кредит", Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE).matcher(source).find(); }

    private Optional<BigDecimal> number(String quote,boolean term) {
        String s=quote.toLowerCase(Locale.ROOT).replace(',','.').replace('\u202f',' ').replace('\u00a0',' ');
        String[][] words={{"двадцать четыре","24"},{"двенадцать","12"},{"полтора","1.5"},{"полторы","1.5"},{"один","1"},{"одна","1"},{"два","2"},{"две","2"},{"три","3"},{"четыре","4"},{"пять","5"},{"шесть","6"},{"семь","7"},{"восемь","8"},{"девять","9"},{"десять","10"}};
        for(var w:words) s=s.replaceAll("(?U)\\b"+w[0]+"\\b",w[1]);
        Matcher m=Pattern.compile("\\d+(?:[ \\u00a0]\\d{3})*(?:\\.\\d+)?").matcher(s);
        if(!m.find()) return Optional.empty();
        BigDecimal n=new BigDecimal(m.group().replace(" ","").replace("\u00a0","")); if(m.find()) return Optional.empty();
        if(term && (s.contains("год") || s.contains("лет"))) n=n.multiply(BigDecimal.valueOf(12));
        else if(!term && (s.contains("млн") || s.contains("миллион"))) n=n.multiply(BigDecimal.valueOf(1_000_000));
        else if(!term && s.contains("тыс")) n=n.multiply(BigDecimal.valueOf(1000));
        return Optional.of(n);
    }
}
