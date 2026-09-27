package com.example.lms.shared.infrastructure.email;

import com.example.lms.shared.application.port.EmailServicePort;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Used only while no demo email provider is configured; never logs recipients or reset links. */
@Component
@Profile("demo")
@ConditionalOnProperty(name = "app.email.delivery", havingValue = "disabled")
public class DemoEmailAdapter implements EmailServicePort {
    @Override public void sendPasswordReset(String to, String name, String link) {}
    @Override public void sendWelcome(String to, String name) {}
    @Override public void sendEnrollmentConfirmation(String to, String name, String course) {}
    @Override public void sendPaymentReceipt(String to, String name, String course, BigDecimal amount,
                                              String transaction, String method, String paidAt) {}
    @Override public void sendEmailVerification(String to, String name, String link) {}
    @Override public void sendRefundNotification(String to, String name, String course, BigDecimal amount,
                                                  String reason, String transaction) {}
    @Override public void sendOrganizationInvite(String to, String organization, String link) {}
    @Override public void sendCourseRejected(String to, String name, String course,
                                              String category, String reason, String link) {}
}
