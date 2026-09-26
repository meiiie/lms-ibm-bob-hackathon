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
    public static final String TEACHER_EMAIL = "teacher@demo.invalid";
    public static final String ORG_ADMIN_EMAIL = "orgadmin@demo.invalid";
    public static final String ADMIN_EMAIL = "admin@demo.invalid";
    private static final UUID STUDENT_ID = UUID.fromString("d3000000-0000-4000-8000-000000000001");
    private static final UUID ORG_ADMIN_ID = UUID.fromString("d3000000-0000-4000-8000-000000000002");
    private static final UUID ADMIN_ID = UUID.fromString("d3000000-0000-4000-8000-000000000003");
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transaction;
    private final DemoReadiness readiness;
    private final String studentPassword;
    private final String teacherPassword;
    private final String orgAdminPassword;
    private final String adminPassword;

    public DemoDataInitializer(JdbcTemplate jdbc, PasswordEncoder passwords, PlatformTransactionManager transactions,
                               DemoReadiness readiness,
                               @Value("${app.demo.student-password}") String studentPassword,
                               @Value("${app.demo.teacher-password}") String teacherPassword,
                               @Value("${app.demo.org-admin-password}") String orgAdminPassword,
                               @Value("${app.demo.admin-password}") String adminPassword) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.transaction = new TransactionTemplate(transactions);
        this.readiness = readiness;
        this.studentPassword = studentPassword;
        this.teacherPassword = teacherPassword;
        this.orgAdminPassword = orgAdminPassword;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        transaction.executeWithoutResult(status -> prepareData());
        // No HTTP request is admitted until the transaction has actually committed.
        readiness.markReady();
    }

    private void prepareData() {
        DemoClass learningClass = jdbc.queryForObject("""
                SELECT lc.id, lc.organization_id, c.teacher_id FROM learning_classes lc
                JOIN courses c ON c.id = lc.course_id
                JOIN users teacher ON teacher.id = c.teacher_id AND teacher.role = 'TEACHER'
                JOIN organizations org ON org.id = lc.organization_id AND org.enabled = true
                WHERE lc.code = 'DEFAULT-SAF-101' AND lc.status = 'OPEN'
                  AND c.code = 'SAF-101' AND c.status = 'APPROVED' AND c.price_type = 'FREE'
                  AND lc.teacher_id = c.teacher_id AND c.organization_id = lc.organization_id
                  AND teacher.organization_id = lc.organization_id
                """, (row, number) -> new DemoClass(row.getObject("id", UUID.class),
                        row.getObject("organization_id", UUID.class), row.getObject("teacher_id", UUID.class)));
        if (learningClass == null) throw new IllegalStateException("The seeded demo learning class is missing.");

        // Keep the seeded teacher ID: course, class and question-bank ownership all refer to it.
        int teachersUpdated = jdbc.update("""
                UPDATE users SET username = 'hackathon_demo_teacher', email = ?, password = ?,
                    full_name = 'Synthetic Demo Teacher', role = 'TEACHER', enabled = true,
                    organization_id = ?, account_status = 'ACTIVE', must_change_password = false,
                    token_expiry_days = 1, status_reason = NULL, status_updated_at = NOW()
                WHERE id = ?
                """, TEACHER_EMAIL, passwords.encode(teacherPassword), learningClass.organizationId(),
                learningClass.teacherId());
        if (teachersUpdated != 1) throw new IllegalStateException("The seeded demo teacher could not be prepared.");

        UUID studentId = prepareAccount(STUDENT_ID, "hackathon_demo", STUDENT_EMAIL, studentPassword,
                "Synthetic Demo Learner", "STUDENT", learningClass.organizationId());
        prepareAccount(ORG_ADMIN_ID, "hackathon_demo_orgadmin", ORG_ADMIN_EMAIL, orgAdminPassword,
                "Synthetic Demo Organization Manager", "ORG_ADMIN", learningClass.organizationId());
        prepareAccount(ADMIN_ID, "hackathon_demo_admin", ADMIN_EMAIL, adminPassword,
                "Synthetic Demo Administrator", "ADMIN", learningClass.organizationId());

        // Discard the random secret so re-enabling a seed user cannot restore a public seed password.
        jdbc.update("""
                UPDATE users SET enabled = false, account_status = 'BLOCKED', password = ?,
                    status_reason = 'Disabled in isolated public demo', status_updated_at = NOW()
                WHERE email NOT IN (?, ?, ?, ?)
                """, passwords.encode(UUID.randomUUID().toString()), STUDENT_EMAIL, TEACHER_EMAIL,
                ORG_ADMIN_EMAIL, ADMIN_EMAIL);

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

    private UUID prepareAccount(UUID id, String username, String email, String password,
                                String fullName, String role, UUID organizationId) {
        UUID actualId = jdbc.queryForObject("""
                INSERT INTO users (id, username, email, password, full_name, role, enabled, created_at,
                    organization_id, account_status, must_change_password, token_expiry_days)
                VALUES (?, ?, ?, ?, ?, ?, true, NOW(), ?, 'ACTIVE', false, 1)
                ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password,
                    role = EXCLUDED.role, enabled = true, account_status = 'ACTIVE',
                    full_name = EXCLUDED.full_name, organization_id = EXCLUDED.organization_id,
                    must_change_password = false, token_expiry_days = 1, status_reason = NULL,
                    status_updated_at = NOW()
                RETURNING id
                """, UUID.class, id, username, email, passwords.encode(password), fullName, role, organizationId);
        if (actualId == null) throw new IllegalStateException("The synthetic demo account could not be prepared.");
        return actualId;
    }

    record DemoClass(UUID id, UUID organizationId, UUID teacherId) {}
}
