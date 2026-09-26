package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatGptSessionServiceTest {
    ChatGptProvider provider;
    MutableClock clock;
    ChatGptSessionService service;
    UUID alice = UUID.randomUUID();
    UUID bob = UUID.randomUUID();
    ChatGptProvider.Credential credential = new ChatGptProvider.Credential("access-secret", "routing-account", 600);

    @BeforeEach
    void setup() {
        provider = mock(ChatGptProvider.class);
        clock = new MutableClock();
        service = new ChatGptSessionService(provider, true, clock);
        lenient().when(provider.start()).thenReturn(Mono.just(new ChatGptProvider.Device("device-secret", "ABCD-EFGH", 5, 900)));
        lenient().when(provider.poll(any())).thenReturn(Mono.just(new ChatGptProvider.Poll(credential, false)));
    }

    @Test
    void disabledFeatureNeverCallsProvider() {
        var disabled = new ChatGptSessionService(provider, false, clock);
        assertThat(disabled.status(alice).enabled()).isFalse();
        assertCode(() -> disabled.start(alice), "disabled");
        assertCode(() -> disabled.poll(alice, "attempt"), "disabled");
        assertCode(() -> disabled.ask(alice, "question"), "disabled");
        assertCode(() -> disabled.disconnect(alice), "disabled");
        verifyNoInteractions(provider);
    }

    @Test
    void statusDoesNotExposeProviderSecrets() throws Exception {
        var pending = service.start(alice);
        assertThat(pending.attemptId()).isNotEqualTo("device-secret");
        String serialized = new ObjectMapper().findAndRegisterModules().writeValueAsString(pending);
        assertThat(serialized).contains("ABCD-EFGH").doesNotContain("device-secret", "access-secret", "routing-account");
        clock.advance(5);
        serialized = new ObjectMapper().findAndRegisterModules().writeValueAsString(service.poll(alice, pending.attemptId()));
        assertThat(serialized).contains("connected").doesNotContain("device-secret", "access-secret", "routing-account", "ABCD-EFGH");
    }

    @Test
    void principalsAreIsolatedAndWrongAttemptDoesNotCallProvider() {
        var first = service.start(alice);
        var second = service.start(bob);
        clock.advance(5);
        assertCode(() -> service.poll(bob, first.attemptId()), "cancelled");
        assertThat(service.poll(alice, first.attemptId()).status()).isEqualTo("connected");
        assertThat(service.status(bob).status()).isEqualTo("pending");
        assertCode(() -> service.ask(bob, "question"), "pending");
        service.disconnect(bob);
        assertThat(service.status(alice).status()).isEqualTo("connected");
        assertThat(second.attemptId()).isNotEqualTo(first.attemptId());
        verify(provider, times(1)).poll(any());
    }

    @Test
    void pollIntervalAndSlowDownAreEnforced() {
        var attempt = service.start(alice);
        assertCode(() -> service.poll(alice, attempt.attemptId()), "rate_limited");
        verify(provider, never()).poll(any());
        clock.advance(5);
        when(provider.poll(any())).thenReturn(Mono.just(new ChatGptProvider.Poll(null, true)));
        assertThat(service.poll(alice, attempt.attemptId()).intervalSeconds()).isEqualTo(10);
        clock.advance(5);
        assertCode(() -> service.poll(alice, attempt.attemptId()), "rate_limited");
        clock.advance(5);
        assertThat(service.poll(alice, attempt.attemptId()).intervalSeconds()).isEqualTo(15);
    }

    @Test
    void expiryClearsPendingAndCredentialWithoutNetwork() {
        var attempt = service.start(alice);
        clock.advance(900);
        assertThat(service.status(alice).status()).isEqualTo("expired");
        assertCode(() -> service.poll(alice, attempt.attemptId()), "expired");
        verify(provider, never()).poll(any());
        connect(alice);
        clock.advance(600);
        assertCode(() -> service.ask(alice, "question"), "expired");
        verify(provider, never()).ask(any(), anyString());
    }

    @Test
    void replacementInvalidatesOldAttempt() {
        var old = service.start(alice);
        clock.advance(5);
        var replacement = service.start(alice);
        clock.advance(5);
        assertCode(() -> service.poll(alice, old.attemptId()), "cancelled");
        assertThat(service.poll(alice, replacement.attemptId()).status()).isEqualTo("connected");
    }

    @Test
    void disconnectCancelsPendingPollAndLateResultCannotResurrectConnection() throws Exception {
        var attempt = service.start(alice);
        clock.advance(5);
        Sinks.One<ChatGptProvider.Poll> result = Sinks.one();
        CountDownLatch subscribed = new CountDownLatch(1);
        when(provider.poll(any())).thenReturn(result.asMono().doOnSubscribe(s -> subscribed.countDown()));
        var request = CompletableFuture.supplyAsync(() -> service.poll(alice, attempt.attemptId()));
        assertThat(subscribed.await(3, TimeUnit.SECONDS)).isTrue();
        assertCode(() -> service.start(alice), "busy");
        service.disconnect(alice);
        assertThatThrownBy(() -> request.get(3, TimeUnit.SECONDS)).hasCauseInstanceOf(ChatGptException.class);
        result.tryEmitValue(new ChatGptProvider.Poll(credential, false));
        assertThat(service.status(alice).status()).isEqualTo("disconnected");
    }

    @Test
    void disconnectCancelsChatAndReplacementSurvivesLateResult() throws Exception {
        connect(alice);
        Sinks.One<String> result = Sinks.one();
        CountDownLatch subscribed = new CountDownLatch(1);
        when(provider.ask(any(), anyString())).thenReturn(result.asMono().doOnSubscribe(s -> subscribed.countDown()));
        var request = CompletableFuture.supplyAsync(() -> service.ask(alice, "study question"));
        assertThat(subscribed.await(3, TimeUnit.SECONDS)).isTrue();
        assertCode(() -> service.ask(alice, "duplicate"), "busy");
        service.disconnect(alice);
        var replacement = service.start(alice);
        result.tryEmitValue("late answer");
        assertThatThrownBy(() -> request.get(3, TimeUnit.SECONDS)).hasCauseInstanceOf(ChatGptException.class);
        assertThat(service.status(alice).attemptId()).isEqualTo(replacement.attemptId());
    }

    @Test
    void unauthorizedInvalidatesButRateLimitPreservesConnection() {
        connect(alice);
        when(provider.ask(any(), anyString())).thenReturn(Mono.error(new ChatGptException("rate_limited", 429, "Wait.")));
        assertCode(() -> service.ask(alice, "question"), "rate_limited");
        assertThat(service.status(alice).status()).isEqualTo("connected");
        when(provider.ask(any(), anyString())).thenReturn(Mono.error(new ChatGptException("unauthorized", 401, "Reconnect.")));
        assertCode(() -> service.ask(alice, "question"), "unauthorized");
        assertThat(service.status(alice).status()).isEqualTo("disconnected");
    }

    @Test
    void credentialExpiringDuringChatDiscardsLateAnswer() throws Exception {
        connect(alice);
        Sinks.One<String> result = Sinks.one();
        CountDownLatch subscribed = new CountDownLatch(1);
        when(provider.ask(any(), anyString())).thenReturn(result.asMono().doOnSubscribe(s -> subscribed.countDown()));
        var request = CompletableFuture.supplyAsync(() -> service.ask(alice, "study question"));
        assertThat(subscribed.await(3, TimeUnit.SECONDS)).isTrue();
        clock.advance(601);
        result.tryEmitValue("late answer");
        assertThatThrownBy(() -> request.get(3, TimeUnit.SECONDS)).hasCauseInstanceOf(ChatGptException.class);
        assertThat(service.status(alice).status()).isEqualTo("expired");
    }

    @Test
    void validatesQuestionAndOnlySendsExplicitQuestion() {
        connect(alice);
        assertCode(() -> service.ask(alice, "  "), "invalid_request");
        assertCode(() -> service.ask(alice, "x".repeat(2001)), "invalid_request");
        when(provider.ask(credential, "What is buoyancy?")).thenReturn(Mono.just("Upward force."));
        assertThat(service.ask(alice, " What is buoyancy? ")).isEqualTo("Upward force.");
        verify(provider).ask(credential, "What is buoyancy?");
    }

    private void connect(UUID owner) {
        var pending = service.start(owner);
        clock.advance(5);
        assertThat(service.poll(owner, pending.attemptId()).status()).isEqualTo("connected");
    }
    private void assertCode(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ChatGptException.class,
                error -> assertThat(error.code()).isEqualTo(code));
    }
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-09-26T00:00:00Z");
        void advance(long seconds) { now = now.plusSeconds(seconds); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
