package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.Duration;
import java.util.UUID;

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
        var provider = diagnostic
                ? new ChatGptProviderAdapter(new ChatGptLiveDiagnostics().client(), new ObjectMapper(),
                    System.getenv().getOrDefault("CHATGPT_MODEL", "gpt-5.4-mini"), Duration.ofSeconds(15), Duration.ofSeconds(45))
                : new ChatGptProviderAdapter(new ObjectMapper(), System.getenv().getOrDefault("CHATGPT_MODEL", "gpt-5.4-mini"));
        var sessions = new ChatGptSessionService(provider, true);
        UUID syntheticOwner = UUID.randomUUID();
        System.out.println("Provider-only live probe using a synthetic LMS owner. This does not verify LMS login or the browser flow.");
        try {
            var state = sessions.start(syntheticOwner);
            System.out.println("Open: " + state.verificationUri());
            System.out.println("Device code: " + state.userCode());
            System.out.println("Attempt: " + state.attemptId());
            System.out.println("Approve personally in your browser. No credentials are read by this runner.");
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
                return diagnosticRetry(sessions, syntheticOwner);
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

    private static int diagnosticRetry(ChatGptSessionService sessions, UUID owner) {
        System.out.println("Diagnostic connection retained for up to 180 seconds. Type retry then Enter to repeat the same harmless question once, or stop to disconnect.");
        var input = new java.io.BufferedReader(new java.io.InputStreamReader(System.in, java.nio.charset.StandardCharsets.UTF_8));
        Instant retryDeadline = Instant.now().plusSeconds(180);
        StringBuilder commandBuffer = new StringBuilder();
        try {
            while (Instant.now().isBefore(retryDeadline)) {
                if (input.ready()) {
                    int character = input.read();
                    if (character < 0) break;
                    if (character != '\n' && character != '\r') {
                        if (commandBuffer.length() >= 16) break;
                        commandBuffer.append((char) character);
                        continue;
                    }
                    String command = commandBuffer.toString();
                    if ("retry".equals(command)) {
                        try {
                            String answer = timedAsk(sessions, owner);
                            System.out.println("Live answer: " + answer);
                            return answer.isBlank() ? 1 : 0;
                        } catch (ChatGptException error) {
                            System.out.println("Safe retry error: " + error.code() + " — " + error.getMessage());
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
}
