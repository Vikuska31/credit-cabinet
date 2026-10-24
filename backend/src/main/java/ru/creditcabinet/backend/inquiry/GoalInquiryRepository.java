package ru.creditcabinet.backend.inquiry;

import java.util.List;
import java.util.Optional;

public interface GoalInquiryRepository {
    void save(GoalInquiry inquiry);

    Optional<GoalInquiry> findById(String id);

    List<GoalInquiry> findOpen();

    /** Новые сверху. */
    List<GoalInquiry> findByCompany(String inn);
}
