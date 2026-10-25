package ru.creditcabinet.backend.web;

import org.springframework.web.bind.annotation.*;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.domain.LoanGoal;
import ru.creditcabinet.backend.inquiry.GoalInquiry;
import ru.creditcabinet.backend.inquiry.GoalInquiryService;
import ru.creditcabinet.backend.notification.Notification;
import ru.creditcabinet.backend.notification.NotificationService;

import java.util.List;

@RestController
@RequestMapping("/api")
public class InquiryAndNotificationController {
    public record InquiryRequest(String text) {}
    public record AnswerRequest(LoanGoal category, String message) {}

    private final GoalInquiryService inquiries;
    private final NotificationService notifications;

    public InquiryAndNotificationController(GoalInquiryService inquiries, NotificationService notifications) {
        this.inquiries = inquiries;
        this.notifications = notifications;
    }

    @PostMapping("/goal-inquiries")
    public GoalInquiry create(Principal p, @RequestBody InquiryRequest r) { return inquiries.create(p, r.text()); }

    @GetMapping("/goal-inquiries")
    public List<GoalInquiry> mine(Principal p) { return inquiries.listMine(p); }

    @GetMapping("/staff/goal-inquiries")
    public List<GoalInquiry> open(Principal p) { return inquiries.listOpen(p); }

    @PostMapping("/staff/goal-inquiries/{id}/answer")
    public GoalInquiry answer(Principal p, @PathVariable String id, @RequestBody AnswerRequest r) {
        return inquiries.answer(p, id, r.category(), r.message());
    }

    @GetMapping("/notifications")
    public List<Notification> notifications(Principal p) { return notifications.list(p); }

    @PostMapping("/notifications/{id}/read")
    public void read(Principal p, @PathVariable long id) { notifications.markRead(p, id); }
}
