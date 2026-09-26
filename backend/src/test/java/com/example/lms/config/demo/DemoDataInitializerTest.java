package com.example.lms.config.demo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
    private final String password = "synthetic-unit-test-password";
    private final DemoDataInitializer initializer = new DemoDataInitializer(jdbc, passwords, transactions, readiness, password);

    @BeforeEach
    void databaseFixture() {
        when(transactions.getTransaction(any())).thenReturn(transaction);
        when(jdbc.queryForObject(anyString(), ArgumentMatchers.<RowMapper<DemoDataInitializer.DemoClass>>any()))
                .thenReturn(new DemoDataInitializer.DemoClass(UUID.randomUUID(), UUID.randomUUID()));
        when(passwords.encode(password)).thenReturn("encoded-password-only");
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(), any(), any(), any()))
                .thenReturn(UUID.randomUUID());
    }

    @Test
    void opensTrafficOnlyAfterSuccessfulCommitAndUsesEncodedPassword() {
        doAnswer(call -> {
            assertThat(readiness.isReady()).isFalse();
            return null;
        }).when(transactions).commit(transaction);
        initializer.run(null);
        assertThat(readiness.isReady()).isTrue();
        verify(transactions).commit(transaction);
        verify(transactions, never()).rollback(any());
        verify(jdbc).queryForObject(anyString(), eq(UUID.class), any(UUID.class),
                eq(DemoDataInitializer.STUDENT_EMAIL), eq("encoded-password-only"), any(UUID.class));
    }

    @Test
    void keepsTrafficClosedAndRollsBackWhenDisablingInheritedAccountsFails() {
        doThrow(new DataAccessResourceFailureException("Synthetic database failure"))
                .when(jdbc).update(anyString(), eq(DemoDataInitializer.STUDENT_EMAIL));
        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(DataAccessResourceFailureException.class);
        assertThat(readiness.isReady()).isFalse();
        verify(transactions).rollback(transaction);
        verify(transactions, never()).commit(any());
        verify(passwords, never()).encode(any());
    }

    @Test
    void failedCommitDoesNotAdvertiseDemoAsReady() {
        doThrow(new TransactionException("Synthetic commit failure") {})
                .when(transactions).commit(transaction);
        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(TransactionException.class);
        assertThat(readiness.isReady()).isFalse();
    }
}
