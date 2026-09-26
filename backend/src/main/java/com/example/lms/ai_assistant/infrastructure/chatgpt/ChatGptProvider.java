package com.example.lms.ai_assistant.infrastructure.chatgpt;

import reactor.core.publisher.Mono;

public interface ChatGptProvider {
    String VERIFICATION_URI = "https://auth.openai.com/codex/device";

    Mono<Device> start();
    Mono<Poll> poll(Device device);
    Mono<String> ask(Credential credential, String question);

    record Device(String deviceId, String userCode, int intervalSeconds, int expiresInSeconds) {
        @Override public String toString() { return "Device[redacted]"; }
    }

    record Credential(String accessToken, String accountId, int expiresInSeconds) {
        @Override public String toString() { return "Credential[redacted]"; }
    }

    record Poll(Credential credential, boolean slowDown) {
        @Override public String toString() { return "Poll[credentialPresent=" + (credential != null) + "]"; }
    }
}
