package ru.creditcabinet.backend.application;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class InMemoryApplicationRepository implements ApplicationRepository {
    private final Map<String, LoanApplication> store = new ConcurrentHashMap<>();
    private final AtomicLong numbers = new AtomicLong();

    @Override public String nextId() { return UUID.randomUUID().toString(); }
    @Override public long nextNumber() { return numbers.incrementAndGet(); }
    @Override public void save(LoanApplication a) { store.put(a.id(), a); }
    @Override public Optional<LoanApplication> findById(String id) { return Optional.ofNullable(store.get(id)); }

    @Override public List<LoanApplication> findByCompany(String inn) {
        return store.values().stream().filter(a -> a.companyInn().equals(inn))
                .sorted(Comparator.comparingLong(LoanApplication::number).reversed()).toList();
    }

    @Override public List<LoanApplication> findAll() {
        return store.values().stream().sorted(Comparator.comparingLong(LoanApplication::number).reversed()).toList();
    }
}
