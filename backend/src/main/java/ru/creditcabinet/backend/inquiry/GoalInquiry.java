package ru.creditcabinet.backend.inquiry;

import ru.creditcabinet.backend.domain.LoanGoal;

import java.time.Instant;

/** Запрос сотруднику по неясной цели «Другое». Это не кредитная заявка. */
public record GoalInquiry(String id, String companyInn, String text, Status status,
                          LoanGoal suggestedCategory, String employeeMessage, Instant createdAt, Instant answeredAt) {

    public enum Status { OPEN, ANSWERED }
}
