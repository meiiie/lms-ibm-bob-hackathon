package com.example.lms.config.demo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DemoDataInitializerTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final SimpleTransactionStatus transaction = new SimpleTransactionStatus();
    private final DemoReadiness readiness = new DemoReadiness();
    private final String studentPassword = "synthetic-student-test-password";
    private final String teacherPassword = "synthetic-teacher-test-password";
    private final String orgAdminPassword = "synthetic-orgadmin-test-password";
    private final String adminPassword = "synthetic-admin-test-password";
    private final UUID classId = UUID.randomUUID();
    private final UUID organizationId = UUID.randomUUID();
    private final UUID teacherId = UUID.randomUUID();
    private final DemoDataInitializer initializer = new DemoDataInitializer(jdbc, passwords, transactions, readiness,
            studentPassword, teacherPassword, orgAdminPassword, adminPassword);

    @BeforeEach
    void databaseFixture() {
        when(transactions.getTransaction(any())).thenReturn(transaction);
        when(jdbc.queryForObject(anyString(), ArgumentMatchers.<RowMapper<DemoDataInitializer.DemoClass>>any()))
                .thenReturn(new DemoDataInitializer.DemoClass(classId, organizationId, teacherId));
        when(passwords.encode(anyString())).thenAnswer(call -> "encoded:" + call.getArgument(0, String.class));
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(call -> call.getArgument(2, UUID.class));
        when(jdbc.update(anyString(), eq(DemoDataInitializer.TEACHER_EMAIL), anyString(),
                eq(organizationId), eq(teacherId))).thenReturn(1);
    }

    @Test
    void preparesAllFourRolesWithEncodedPasswordsInTheExistingOrganizationBeforeOpeningTraffic() {
        doAnswer(call -> {
            assertThat(readiness.isReady()).isFalse();
            return null;
        }).when(transactions).commit(transaction);

        initializer.run(null);

        assertThat(readiness.isReady()).isTrue();
        verify(transactions).commit(transaction);
        verify(transactions, never()).rollback(any());
        verifyAccount("d3000000-0000-4000-8000-000000000001", "hackathon_demo",
                DemoDataInitializer.STUDENT_EMAIL, studentPassword, "Synthetic Demo Learner", "STUDENT");
        verifyAccount("d3000000-0000-4000-8000-000000000002", "hackathon_demo_orgadmin",
                DemoDataInitializer.ORG_ADMIN_EMAIL, orgAdminPassword, "Synthetic Demo Organization Manager", "ORG_ADMIN");
        verifyAccount("d3000000-0000-4000-8000-000000000003", "hackathon_demo_admin",
                DemoDataInitializer.ADMIN_EMAIL, adminPassword, "Synthetic Demo Administrator", "ADMIN");
        // Updating the teacher in place leaves all foreign-key ownership on the seeded ID intact.
        verify(jdbc).update(contains("WHERE id = ?"), eq(DemoDataInitializer.TEACHER_EMAIL),
                eq("encoded:" + teacherPassword), eq(organizationId), eq(teacherId));
        verify(passwords).encode(studentPassword);
        verify(passwords).encode(teacherPassword);
        verify(passwords).encode(orgAdminPassword);
        verify(passwords).encode(adminPassword);
    }

    @Test
    void restartPreservesExistingStudentIdentityAndNeverOverwritesEnrollmentProgress() {
        UUID existingStudentId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(), any(), eq(DemoDataInitializer.STUDENT_EMAIL),
                any(), any(), any(), any())).thenReturn(existingStudentId);

        initializer.run(null);
        initializer.run(null);

        ArgumentCaptor<String> enrollmentSql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).update(enrollmentSql.capture(), eq(classId), eq(existingStudentId));
        assertThat(enrollmentSql.getAllValues()).allSatisfy(sql -> assertThat(sql)
                .contains("ON CONFLICT (student_id, class_id) DO NOTHING")
                .doesNotContain("DO UPDATE", "DELETE"));
        verify(jdbc, times(2)).update(anyString(), eq(DemoDataInitializer.TEACHER_EMAIL), anyString(),
                eq(organizationId), eq(teacherId));
    }

    @Test
    void disablesEveryOtherAccountAndReplacesPublicSeedPasswordsWithAFreshDiscardedSecret() {
        initializer.run(null);
        initializer.run(null);

        ArgumentCaptor<String> disabledPassword = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).update(contains("WHERE email NOT IN (?, ?, ?, ?)"), disabledPassword.capture(),
                eq(DemoDataInitializer.STUDENT_EMAIL), eq(DemoDataInitializer.TEACHER_EMAIL),
                eq(DemoDataInitializer.ORG_ADMIN_EMAIL), eq(DemoDataInitializer.ADMIN_EMAIL));
        assertThat(disabledPassword.getAllValues()).allSatisfy(hash -> {
            assertThat(hash).startsWith("encoded:");
            UUID.fromString(hash.substring("encoded:".length()));
        });
        assertThat(disabledPassword.getAllValues().get(0)).isNotEqualTo(disabledPassword.getAllValues().get(1));
    }

    @Test
    void keepsTrafficClosedAndRollsBackWhenDisablingInheritedAccountsFails() {
        doThrow(new DataAccessResourceFailureException("Synthetic database failure"))
                .when(jdbc).update(anyString(), anyString(), eq(DemoDataInitializer.STUDENT_EMAIL),
                        eq(DemoDataInitializer.TEACHER_EMAIL), eq(DemoDataInitializer.ORG_ADMIN_EMAIL),
                        eq(DemoDataInitializer.ADMIN_EMAIL));

        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(DataAccessResourceFailureException.class);

        assertThat(readiness.isReady()).isFalse();
        verify(transactions).rollback(transaction);
        verify(transactions, never()).commit(any());
        verify(jdbc, never()).update(anyString(), eq(classId), any(UUID.class));
    }

    @Test
    void missingCourseOrOrganizationFailsBeforeChangingAnyAccounts() {
        when(jdbc.queryForObject(anyString(), ArgumentMatchers.<RowMapper<DemoDataInitializer.DemoClass>>any()))
                .thenReturn(null);

        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(IllegalStateException.class);

        assertThat(readiness.isReady()).isFalse();
        verify(transactions).rollback(transaction);
        verifyNoInteractions(passwords);
    }

    @Test
    void missingTeacherFailsWithoutCreatingAnUnrelatedTeacherIdentity() {
        when(jdbc.update(anyString(), eq(DemoDataInitializer.TEACHER_EMAIL), anyString(),
                eq(organizationId), eq(teacherId))).thenReturn(0);

        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(IllegalStateException.class);

        assertThat(readiness.isReady()).isFalse();
        verify(transactions).rollback(transaction);
        verify(jdbc, never()).queryForObject(anyString(), eq(UUID.class), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void failedCommitDoesNotAdvertiseDemoAsReady() {
        doThrow(new TransactionException("Synthetic commit failure") {})
                .when(transactions).commit(transaction);

        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(TransactionException.class);

        assertThat(readiness.isReady()).isFalse();
    }

    private void verifyAccount(String id, String username, String email, String password, String fullName, String role) {
        verify(jdbc).queryForObject(contains("ON CONFLICT (email) DO UPDATE"), eq(UUID.class), eq(UUID.fromString(id)),
                eq(username), eq(email), eq("encoded:" + password), eq(fullName), eq(role), eq(organizationId));
    }
}
