package com.example.lms.ai_assistant.infrastructure.web;

import com.example.lms.ai_assistant.infrastructure.chatgpt.ChatGptException;
import com.example.lms.ai_assistant.infrastructure.chatgpt.ChatGptSessionService;
import com.example.lms.identity.infrastructure.persistence.entity.UserJpaEntity;
import com.example.lms.shared.infrastructure.web.ApiResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v3/ai/chatgpt")
@PreAuthorize("isAuthenticated()")
public class ChatGptControllerV3 {
    private final ChatGptSessionService sessions;

    public ChatGptControllerV3(ChatGptSessionService sessions) { this.sessions = sessions; }

    public record PollRequest(String attemptId) {}
    public record AskRequest(String question) {}

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<?>> status(@AuthenticationPrincipal UserJpaEntity user) {
        return ok(sessions.status(owner(user)));
    }

    @PostMapping("/device")
    public ResponseEntity<ApiResponse<?>> start(@AuthenticationPrincipal UserJpaEntity user) {
        return ok(sessions.start(owner(user)));
    }

    @PostMapping("/poll")
    public ResponseEntity<ApiResponse<?>> poll(@AuthenticationPrincipal UserJpaEntity user, @RequestBody PollRequest body) {
        UUID owner = owner(user);
        if (body.attemptId() == null || body.attemptId().length() > 64) {
            throw new ChatGptException("invalid_request", 400, "A valid connection attempt is required.");
        }
        return ok(sessions.poll(owner, body.attemptId()));
    }

    @PostMapping("/ask")
    public ResponseEntity<ApiResponse<?>> ask(@AuthenticationPrincipal UserJpaEntity user, @RequestBody AskRequest body) {
        return ok(Map.of("answer", sessions.ask(owner(user), body.question())));
    }

    @DeleteMapping("/connection")
    public ResponseEntity<ApiResponse<?>> disconnect(@AuthenticationPrincipal UserJpaEntity user) {
        return ok(sessions.disconnect(owner(user)));
    }

    @ExceptionHandler(ChatGptException.class)
    public ResponseEntity<ApiResponse<?>> error(ChatGptException error) {
        return ResponseEntity.status(error.status()).cacheControl(CacheControl.noStore())
                .body(ApiResponse.error(error.code(), error.getMessage()));
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<?>> invalidBody() {
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .body(ApiResponse.error("invalid_request", "Provide a valid JSON request."));
    }

    private UUID owner(UserJpaEntity user) {
        if (user == null || user.getId() == null) {
            throw new ChatGptException("unauthorized", 401, "Sign in to the LMS first.");
        }
        return user.getId();
    }

    private ResponseEntity<ApiResponse<?>> ok(Object value) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(value));
    }
}
