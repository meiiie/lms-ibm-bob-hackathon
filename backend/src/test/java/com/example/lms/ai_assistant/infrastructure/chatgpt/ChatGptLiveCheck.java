package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.Duration;
import java.util.UUID;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import reactor.core.publisher.Mono;

/** Manual provider-only probe, deliberately not a JUnit test and never run by CI. */
public final class ChatGptLiveCheck {
    private ChatGptLiveCheck() {}

    public static void main(String[] args) {
        System.exit(run());
    }

    private static int run() {
        if (!"true".equals(System.getenv("CHATGPT_LIVE_CHECK"))) {
            System.out.println("Disabled. Set CHATGPT_LIVE_CHECK=true to explicitly start personal device consent.");
            return 2;
        }
        boolean diagnostic = "true".equals(System.getenv("CHATGPT_LIVE_DIAGNOSTICS"));
        var provider = new ProbeProvider(diagnostic, System.getenv().getOrDefault("CHATGPT_MODEL", "gpt-6-luna"));
        var sessions = new ChatGptSessionService(provider, true);
        UUID syntheticOwner = UUID.randomUUID();
        System.out.println("Provider-only live probe using a synthetic LMS owner. This does not verify LMS login or the browser flow.");
        try {
            var state = sessions.start(syntheticOwner);
            System.out.println("Open: " + state.verificationUri());
            System.out.println("Device code: " + state.userCode());
            System.out.println("Attempt: " + state.attemptId());
            System.out.println("Approve personally in your browser. No existing login cache is read; fresh credentials remain in memory.");
            Instant deadline = Instant.now().plusSeconds(600);
            while (Instant.now().isBefore(deadline) && "pending".equals(state.status())) {
                Thread.sleep(state.intervalSeconds() * 1000L);
                state = sessions.poll(syntheticOwner, state.attemptId());
            }
            System.out.println("Connection state: " + state.status());
            if ("connected".equals(state.status())) {
                String answer = timedAsk(sessions, syntheticOwner);
                System.out.println("Live answer: " + answer);
                return answer.isBlank() ? 1 : 0;
            } else {
                System.out.println("No completed live answer; the bounded consent wait ended.");
                return 3;
            }
        } catch (ChatGptException error) {
            System.out.println("Safe error: " + error.code() + " — " + error.getMessage());
            if (diagnostic && "connected".equals(sessions.status(syntheticOwner).status())) {
                return diagnosticRetry(sessions, syntheticOwner, provider);
            }
            return 1;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            System.out.println("Probe interrupted before verification completed.");
            return 130;
        } finally {
            sessions.disconnect(syntheticOwner);
            System.out.println("Probe connection discarded from server memory.");
        }
    }

    private static String timedAsk(ChatGptSessionService sessions, UUID owner) {
        long started = System.nanoTime();
        try {
            return sessions.ask(owner, "Reply with one short sentence explaining what a lifeboat is.");
        } finally {
            System.out.println("Inference elapsed milliseconds: " + (System.nanoTime() - started) / 1_000_000);
        }
    }

    private static int diagnosticRetry(ChatGptSessionService sessions, UUID owner, ProbeProvider provider) {
        System.out.println("Diagnostic connection retained for up to 180 seconds. Type retry or retry <model>, then Enter; stop disconnects. At most two explicit retries. Allowed models: " + ProbeProvider.MODELS);
        var input = new java.io.BufferedReader(new java.io.InputStreamReader(System.in, java.nio.charset.StandardCharsets.UTF_8));
        Instant retryDeadline = Instant.now().plusSeconds(180);
        StringBuilder commandBuffer = new StringBuilder();
        int attempts = 0;
        try {
            while (Instant.now().isBefore(retryDeadline) && attempts < 2) {
                if (input.ready()) {
                    int character = input.read();
                    if (character < 0) break;
                    if (character != '\n' && character != '\r') {
                        if (commandBuffer.length() >= 48) break;
                        commandBuffer.append((char) character);
                        continue;
                    }
                    String command = commandBuffer.toString();
                    commandBuffer.setLength(0);
                    if (command.isBlank()) continue;
                    if (command.startsWith("retry ")) {
                        if (!provider.selectModel(command.substring(6).trim())) {
                            System.out.println("Choose one of the allowed models.");
                            continue;
                        }
                        command = "retry";
                    }
                    if ("retry".equals(command)) {
                        attempts++;
                        try {
                            String answer = timedAsk(sessions, owner);
                            System.out.println("Live answer: " + answer);
                            return answer.isBlank() ? 1 : 0;
                        } catch (ChatGptException error) {
                            System.out.println("Safe retry error: " + error.code() + " — " + error.getMessage());
                            continue;
                        }
                    }
                    break;
                }
                Thread.sleep(250);
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return 130;
        } catch (java.io.IOException ignored) {
            System.out.println("Diagnostic input unavailable.");
        }
        return 1;
    }

    /** Test-only selection: credentials remain exclusively in the owner-bound session service. */
    private static final class ProbeProvider implements ChatGptProvider {
        private static final Set<String> MODELS = Set.of("gpt-6-luna", "gpt-6-sol", "gpt-6-astra", "gpt-5.6-luna");
        private final AtomicReference<String> model;
        private final org.springframework.web.reactive.function.client.WebClient client;
        private final ObjectMapper json = new ObjectMapper();

        ProbeProvider(boolean diagnostic, String initialModel) {
            model = new AtomicReference<>(initialModel);
            client = diagnostic ? new ChatGptLiveDiagnostics().client()
                    : org.springframework.web.reactive.function.client.WebClient.builder()
                        .codecs(c -> c.defaultCodecs().maxInMemorySize(65_536)).build();
        }

        boolean selectModel(String next) {
            if (!MODELS.contains(next)) return false;
            model.set(next);
            System.out.println("Probe model: " + next);
            return true;
        }

        private ChatGptProviderAdapter adapter() {
            return new ChatGptProviderAdapter(client, json, model.get(), Duration.ofSeconds(15), Duration.ofSeconds(45));
        }
        @Override public Mono<Device> start() { return adapter().start(); }
        @Override public Mono<Poll> poll(Device device) { return adapter().poll(device); }
        @Override public Mono<String> ask(Credential credential, String question) {
            System.out.println("Probe model: " + (MODELS.contains(model.get()) ? model.get() : "configured custom model"));
            return adapter().ask(credential, question);
        }
    }
}
