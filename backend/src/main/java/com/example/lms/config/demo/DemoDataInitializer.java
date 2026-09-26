package com.example.lms.config.demo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

/** Prepares only an explicitly acknowledged, disposable database; never resets learning progress. */
@Component
@Profile("demo")
public class DemoDataInitializer implements ApplicationRunner {
    public static final String STUDENT_EMAIL = "learner@demo.invalid";
    private static final UUID STUDENT_ID = UUID.fromString("d3000000-0000-4000-8000-000000000001");
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transaction;
    private final DemoReadiness readiness;
    private final String password;

    public DemoDataInitializer(JdbcTemplate jdbc, PasswordEncoder passwords, PlatformTransactionManager transactions,
                               DemoReadiness readiness, @Value("${app.demo.student-password}") String password) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.transaction = new TransactionTemplate(transactions);
        this.readiness = readiness;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        transaction.executeWithoutResult(status -> prepareData());
        // No HTTP request is admitted until the transaction has actually committed.
        readiness.markReady();
    }

    private void prepareData() {
        DemoClass learningClass = jdbc.queryForObject("""
                SELECT lc.id, lc.organization_id FROM learning_classes lc
                JOIN courses c ON c.id = lc.course_id
                WHERE lc.code = 'DEFAULT-SAF-101' AND lc.status = 'OPEN'
                  AND c.code = 'SAF-101' AND c.status = 'APPROVED' AND c.price_type = 'FREE'
                """, (row, number) -> new DemoClass(row.getObject("id", UUID.class),
                        row.getObject("organization_id", UUID.class)));
        if (learningClass == null) throw new IllegalStateException("The seeded demo learning class is missing.");

        jdbc.update("""
                UPDATE users SET enabled = false, account_status = 'BLOCKED',
                    status_reason = 'Disabled in isolated public demo', status_updated_at = NOW()
                WHERE email <> ?
                """, STUDENT_EMAIL);
        UUID studentId = jdbc.queryForObject("""
                INSERT INTO users (id, username, email, password, full_name, role, enabled, created_at,
                    organization_id, account_status, must_change_password, token_expiry_days)
                VALUES (?, 'hackathon_demo', ?, ?, 'Synthetic Demo Learner', 'STUDENT', true, NOW(),
                    ?, 'ACTIVE', false, 1)
                ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password,
                    role = 'STUDENT', enabled = true, account_status = 'ACTIVE',
                    full_name = 'Synthetic Demo Learner', organization_id = EXCLUDED.organization_id,
                    must_change_password = false, token_expiry_days = 1, status_reason = NULL,
                    status_updated_at = NOW()
                RETURNING id
                """, UUID.class, STUDENT_ID, STUDENT_EMAIL, passwords.encode(password), learningClass.organizationId());
        if (studentId == null) throw new IllegalStateException("The synthetic demo account could not be prepared.");

        jdbc.update("""
                INSERT INTO enrollments (id, class_id, student_id, status, completion_percent,
                    progress, enrolled_at, joined_at, last_accessed_at, version)
                VALUES (gen_random_uuid(), ?, ?, 'ACTIVE', 0, '{}'::jsonb, NOW(), NOW(), NOW(), 0)
                ON CONFLICT (student_id, class_id) DO NOTHING
                """, learningClass.id(), studentId);
        jdbc.update("""
                INSERT INTO admin_settings (setting_key, setting_value, updated_at)
                VALUES ('payment', '{"stripePublicKey":"","stripeSecretKey":"","paypalClientId":"",
                    "paypalClientSecret":"","currency":"VND","vnpayEnabled":false,"sepayEnabled":false}', NOW())
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
                """);
    }

    record DemoClass(UUID id, UUID organizationId) {}
}
