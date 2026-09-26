package com.example.lms.ai_assistant.infrastructure.chatgpt;

public final class ChatGptException extends RuntimeException {
    private final String code;
    private final int status;

    public ChatGptException(String code, int status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String code() { return code; }
    public int status() { return status; }

    public static ChatGptException unavailable() {
        return new ChatGptException("unavailable", 503, "ChatGPT is temporarily unavailable. Try again later.");
    }

    public static ChatGptException cancelled() {
        return new ChatGptException("cancelled", 409, "This connection attempt was cancelled. Connect again.");
    }
}
