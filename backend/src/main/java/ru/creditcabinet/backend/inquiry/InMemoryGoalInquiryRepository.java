package ru.creditcabinet.backend.inquiry;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class InMemoryGoalInquiryRepository implements GoalInquiryRepository {
    private final Map<String, GoalInquiry> store = new LinkedHashMap<>();

    @Override public synchronized void save(GoalInquiry i) { store.put(i.id(), i); }
    @Override public synchronized Optional<GoalInquiry> findById(String id) { return Optional.ofNullable(store.get(id)); }

    @Override public synchronized List<GoalInquiry> findOpen() {
        return store.values().stream().filter(g -> g.status() == GoalInquiry.Status.OPEN).toList();
    }

    @Override public synchronized List<GoalInquiry> findByCompany(String inn) {
        return store.values().stream().filter(g -> g.companyInn().equals(inn))
                .sorted(Comparator.comparing(GoalInquiry::createdAt).reversed()).toList();
    }
}
