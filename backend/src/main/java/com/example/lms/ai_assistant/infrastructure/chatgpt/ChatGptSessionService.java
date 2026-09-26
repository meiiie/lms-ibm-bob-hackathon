package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

@Service
public class ChatGptSessionService {
    private final boolean enabled;
    private final ChatGptProvider provider;
    private final Clock clock;
    private final Cache<UUID, State> sessions;

    @Autowired
    public ChatGptSessionService(ChatGptProvider provider,
                                @Value("${chatgpt.enabled:false}") boolean enabled) {
        this(provider, enabled, Clock.systemUTC());
    }

    ChatGptSessionService(ChatGptProvider provider, boolean enabled, Clock clock) {
        this.provider = provider;
        this.enabled = enabled;
        this.clock = clock;
        this.sessions = Caffeine.newBuilder().maximumSize(512).expireAfterWrite(Duration.ofHours(1))
                .<UUID, State>removalListener((owner, state, cause) -> { if (state != null) state.cancel(); })
                .build();
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Status(boolean enabled, String status, Instant expiresAt, String attemptId,
                         String verificationUri, String userCode, Integer intervalSeconds) {}

    private static final class State {
        final String attemptId = UUID.randomUUID().toString();
        final Instant started;
        final AtomicBoolean busy = new AtomicBoolean();
        final Sinks.Empty<Void> cancellation = Sinks.empty();
        volatile boolean cancelled;
        ChatGptProvider.Device device;
        ChatGptProvider.Credential credential;
        Instant expiresAt;
        Instant nextPoll;
        int interval;
        State(Instant started) { this.started = started; }
        void cancel() { cancelled = true; cancellation.tryEmitEmpty(); }
    }

    public Status status(UUID owner) {
        if (!enabled) return disconnected(false);
        State state = sessions.getIfPresent(owner);
        if (state == null) return disconnected(true);
        synchronized (state) {
            expire(state);
            if (state.credential != null) return new Status(true, "connected", state.expiresAt, null, null, null, null);
            if (state.device != null) return pending(state);
            return state.expiresAt != null ? new Status(true, "expired", state.expiresAt, null, null, null, null) : disconnected(true);
        }
    }

    public Status start(UUID owner) {
        requireEnabled();
        Instant now = clock.instant();
        State state = new State(now);
        state.busy.set(true);
        sessions.asMap().compute(owner, (id, previous) -> {
            if (previous != null && previous.busy.get()) throw busy();
            if (previous != null && now.isBefore(previous.started.plusSeconds(5))) throw rateLimited();
            if (previous != null) previous.cancel();
            return state;
        });
        try {
            ChatGptProvider.Device device = execute(state, provider::start);
            update(owner, state, () -> {
                state.device = device;
                state.interval = device.intervalSeconds();
                state.expiresAt = clock.instant().plusSeconds(device.expiresInSeconds());
                state.nextPoll = clock.instant().plusSeconds(state.interval);
            });
            return status(owner);
        } catch (RuntimeException error) {
            sessions.asMap().remove(owner, state);
            throw error;
        } finally {
            state.busy.set(false);
        }
    }

    public Status poll(UUID owner, String attemptId) {
        requireEnabled();
        State state = requireState(owner);
        ChatGptProvider.Device device;
        synchronized (state) {
            expire(state);
            if (!state.attemptId.equals(attemptId)) throw ChatGptException.cancelled();
            if (state.credential != null) return status(owner);
            if (state.device == null) throw expired();
            if (clock.instant().isBefore(state.nextPoll)) throw rateLimited();
            lock(state);
            state.nextPoll = clock.instant().plusSeconds(state.interval);
            device = state.device;
        }
        try {
            ChatGptProvider.Poll result = execute(state, () -> provider.poll(device));
            update(owner, state, () -> {
                expire(state);
                if (state.device == null) throw expired();
                if (result.credential() != null) {
                    state.credential = result.credential();
                    state.device = null;
                    state.expiresAt = clock.instant().plusSeconds(Math.min(result.credential().expiresInSeconds(), 3600));
                } else if (result.slowDown()) {
                    state.interval = Math.min(60, state.interval + 5);
                    state.nextPoll = clock.instant().plusSeconds(state.interval);
                }
            });
            return status(owner);
        } catch (ChatGptException error) {
            if ("unauthorized".equals(error.code()) || "expired".equals(error.code())) invalidate(owner, state);
            throw error;
        } finally {
            state.busy.set(false);
        }
    }

    public String ask(UUID owner, String question) {
        requireEnabled();
        if (question == null || question.isBlank() || question.length() > 2000) {
            throw new ChatGptException("invalid_request", 400, "Enter a study question of 1 to 2000 characters.");
        }
        State state = requireState(owner);
        ChatGptProvider.Credential credential;
        synchronized (state) {
            expire(state);
            if (state.credential == null) {
                if (state.device != null) throw new ChatGptException("pending", 409, "Complete ChatGPT authorization first.");
                throw expired();
            }
            lock(state);
            credential = state.credential;
        }
        try {
            String answer = execute(state, () -> provider.ask(credential, question.strip()));
            update(owner, state, () -> {
                expire(state);
                if (state.credential != credential) throw expired();
            });
            return answer;
        } catch (ChatGptException error) {
            if ("unauthorized".equals(error.code())) invalidate(owner, state);
            throw error;
        } finally {
            state.busy.set(false);
        }
    }

    public Status disconnect(UUID owner) {
        requireEnabled();
        sessions.asMap().computeIfPresent(owner, (id, state) -> { state.cancel(); return null; });
        return disconnected(true);
    }

    private <T> T execute(State state, Supplier<Mono<T>> operation) {
        if (state.cancelled) throw ChatGptException.cancelled();
        try {
            return operation.get().takeUntilOther(state.cancellation.asMono())
                    .switchIfEmpty(Mono.error(ChatGptException.cancelled())).block(Duration.ofSeconds(50));
        } catch (ChatGptException error) {
            throw error;
        } catch (RuntimeException ignored) {
            throw ChatGptException.unavailable();
        }
    }

    private void update(UUID owner, State state, Runnable mutation) {
        sessions.asMap().compute(owner, (id, current) -> {
            if (current != state || state.cancelled) throw ChatGptException.cancelled();
            synchronized (state) { mutation.run(); }
            return current;
        });
    }

    private void invalidate(UUID owner, State state) {
        sessions.asMap().remove(owner, state);
        state.cancel();
    }

    private void expire(State state) {
        if (state.expiresAt != null && !clock.instant().isBefore(state.expiresAt)) {
            state.device = null;
            state.credential = null;
            state.cancel();
        }
    }

    private State requireState(UUID owner) {
        State state = sessions.getIfPresent(owner);
        if (state == null) throw new ChatGptException("unauthorized", 409, "Connect your ChatGPT account first.");
        return state;
    }
    private void requireEnabled() {
        if (!enabled) throw new ChatGptException("disabled", 503, "Personal ChatGPT connection is disabled on this server.");
    }
    private static void lock(State state) {
        if (!state.busy.compareAndSet(false, true)) throw busy();
    }
    private static Status pending(State state) {
        return new Status(true, "pending", state.expiresAt, state.attemptId,
                ChatGptProvider.VERIFICATION_URI, state.device.userCode(), state.interval);
    }
    private static Status disconnected(boolean enabled) { return new Status(enabled, "disconnected", null, null, null, null, null); }
    private static ChatGptException expired() { return new ChatGptException("expired", 410, "Your ChatGPT connection or code expired. Connect again."); }
    private static ChatGptException busy() { return new ChatGptException("busy", 409, "A ChatGPT request is already running. Please wait."); }
    private static ChatGptException rateLimited() { return new ChatGptException("rate_limited", 429, "Please wait before checking or starting another connection."); }
}
