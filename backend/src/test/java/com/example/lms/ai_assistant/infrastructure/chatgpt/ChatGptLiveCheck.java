package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
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
        var provider = new ChatGptProviderAdapter(new ObjectMapper(),
                System.getenv().getOrDefault("CHATGPT_MODEL", "gpt-5.4-mini"));
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
                String answer = sessions.ask(syntheticOwner,
                        "Reply with one short sentence explaining what a lifeboat is.");
                System.out.println("Live answer: " + answer);
                return answer.isBlank() ? 1 : 0;
            } else {
                System.out.println("No completed live answer; the bounded consent wait ended.");
                return 3;
            }
        } catch (ChatGptException error) {
            System.out.println("Safe error: " + error.code() + " — " + error.getMessage());
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
}
