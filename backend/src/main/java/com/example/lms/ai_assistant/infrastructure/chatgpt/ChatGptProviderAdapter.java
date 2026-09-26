package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Experimental protocol reference: vishhvak/chatgpt-oauth@53299ef0 (MIT), PROTOCOL.md. */
@Component
public class ChatGptProviderAdapter implements ChatGptProvider {
    static final String CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
    static final String AUTH = "https://auth.openai.com";
    static final String RESPONSES = "https://chatgpt.com/backend-api/codex/responses?client_version=0.144.6";
    static final int MAX_STREAM_BYTES = 262_144;
    static final int MAX_ANSWER_CHARS = 20_000;
    private final WebClient client;
    private final ObjectMapper json;
    private final String model;
    private final String sessionId = UUID.randomUUID().toString();
    private final Duration authTimeout;
    private final Duration answerTimeout;

    @Autowired
    public ChatGptProviderAdapter(ObjectMapper json, @Value("${chatgpt.model:gpt-5.4-mini}") String model) {
        this(WebClient.builder().codecs(c -> c.defaultCodecs().maxInMemorySize(65_536)).build(),
                json, model, Duration.ofSeconds(15), Duration.ofSeconds(45));
    }

    ChatGptProviderAdapter(WebClient client, ObjectMapper json, String model,
                          Duration authTimeout, Duration answerTimeout) {
        this.client = client;
        this.json = json;
        this.model = model;
        this.authTimeout = authTimeout;
        this.answerTimeout = answerTimeout;
    }

    @Override
    public Mono<Device> start() {
        return safe(client.post().uri(AUTH + "/api/accounts/deviceauth/usercode")
                .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("client_id", CLIENT_ID))
                .exchangeToMono(this::jsonResponse).map(data -> new Device(
                        required(data, "device_auth_id", 4096),
                        required(data, data.has("user_code") ? "user_code" : "usercode", 128),
                        bounded(data.path("interval").asInt(5), 5, 60),
                        bounded(data.path("expires_in").asInt(900), 1, 900))), authTimeout);
    }

    @Override
    public Mono<Poll> poll(Device device) {
        return safe(client.post().uri(AUTH + "/api/accounts/deviceauth/token")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("device_auth_id", device.deviceId(), "user_code", device.userCode()))
                .exchangeToMono(response -> {
                    int status = response.statusCode().value();
                    if (status == 403 || status == 404) {
                        return response.releaseBody().thenReturn(new Poll(null, false));
                    }
                    if (status == 400) {
                        return response.bodyToMono(JsonNode.class).flatMap(data -> {
                            String code = data.path("error").asText();
                            if ("authorization_pending".equals(code)) return Mono.just(new Poll(null, false));
                            if ("slow_down".equals(code)) return Mono.just(new Poll(null, true));
                            if ("expired_token".equals(code)) return Mono.error(expired());
                            return Mono.error(ChatGptException.unavailable());
                        });
                    }
                    return jsonResponse(response).flatMap(data -> exchange(
                            required(data, "authorization_code", 8192), required(data, "code_verifier", 8192)))
                            .map(credential -> new Poll(credential, false));
                }), authTimeout);
    }

    private Mono<Credential> exchange(String code, String verifier) {
        return client.post().uri(AUTH + "/oauth/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData("grant_type", "authorization_code")
                        .with("client_id", CLIENT_ID).with("code", code).with("code_verifier", verifier)
                        .with("redirect_uri", AUTH + "/deviceauth/callback"))
                .exchangeToMono(this::jsonResponse).map(data -> {
                    String token = required(data, "access_token", 32768);
                    int ttl = data.path("expires_in").asInt(0);
                    if (ttl <= 0) throw ChatGptException.unavailable();
                    String account = accountId(data.path("id_token").asText(""));
                    if (account == null) account = accountId(token);
                    return new Credential(token, account, Math.min(ttl, 3600));
                });
    }

    private String accountId(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2 || parts[1].length() > 32768) return null;
            String id = json.readTree(Base64.getUrlDecoder().decode(parts[1]))
                    .path("https://api.openai.com/auth").path("chatgpt_account_id").asText("");
            // Routing metadata only; the LMS principal remains the sole owner identity.
            return id.matches("[A-Za-z0-9_-]{1,128}") ? id : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    @Override
    public Mono<String> ask(Credential credential, String question) {
        return Mono.defer(() -> {
            var request = client.post().uri(RESPONSES).contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        headers.setBearerAuth(credential.accessToken());
                        headers.set("openai-beta", "responses=experimental");
                        headers.set("originator", "codex_cli_rs");
                        headers.set("session_id", sessionId);
                        if (credential.accountId() != null) headers.set("chatgpt-account-id", credential.accountId());
                    })
                    .bodyValue(Map.of("model", model, "instructions", "Help the learner understand their study question. Give a concise plain-text explanation. Do not execute tools.",
                            "input", List.of(Map.of("type", "message", "role", "user", "content",
                                    List.of(Map.of("type", "input_text", "text", question)))),
                            "parallel_tool_calls", false, "store", false, "stream", true));
            SseAnswer answer = new SseAnswer();
            // Read the successful stream directly so cancellation does not attempt a second body drain.
            return safe(request.retrieve().onStatus(status -> !status.is2xxSuccessful(),
                            response -> Mono.just(upstreamError(response.statusCode().value())))
                        .bodyToFlux(org.springframework.core.io.buffer.DataBuffer.class)
                        .<Boolean>handle((buffer, sink) -> {
                            try {
                                int size = buffer.readableByteCount();
                                if (size > MAX_STREAM_BYTES - answer.totalBytes) throw tooLarge();
                                byte[] chunk = new byte[size];
                                buffer.read(chunk);
                                sink.next(answer.accept(chunk));
                            } finally {
                                DataBufferUtils.release(buffer);
                            }
                        }).takeUntil(Boolean::booleanValue)
                        .doOnDiscard(org.springframework.core.io.buffer.DataBuffer.class, DataBufferUtils::release)
                        .then(Mono.fromCallable(answer::finish)), answerTimeout);
        });
    }

    String parseAnswer(String stream) {
        SseAnswer answer = new SseAnswer();
        answer.accept(stream.getBytes(StandardCharsets.UTF_8));
        return answer.finish();
    }

    private final class SseAnswer {
        private final StringBuilder answer = new StringBuilder();
        private final ByteArrayOutputStream frame = new ByteArrayOutputStream();
        private int totalBytes;
        private int lineBytes;
        private boolean previousCr;
        private boolean completed;

        boolean accept(byte[] chunk) {
            if (chunk.length > MAX_STREAM_BYTES - totalBytes) throw tooLarge();
            totalBytes += chunk.length;
            for (byte value : chunk) {
                if (completed) break;
                if (value == '\r') {
                    newline();
                    previousCr = true;
                } else if (value == '\n') {
                    if (!previousCr) newline();
                    previousCr = false;
                } else {
                    previousCr = false;
                    frame.write(value);
                    lineBytes++;
                }
            }
            return completed;
        }

        private void newline() {
            if (lineBytes == 0) {
                processFrame();
                frame.reset();
            } else {
                frame.write('\n');
                lineBytes = 0;
            }
        }

        String finish() {
            if (!completed && frame.size() > 0) processFrame();
            if (!completed || answer.toString().isBlank()) throw ChatGptException.unavailable();
            return answer.toString();
        }

        private void processFrame() {
            StringBuilder data = new StringBuilder();
            String eventName = "message";
            for (String line : frame.toString(StandardCharsets.UTF_8).split("\n")) {
                if (line.startsWith("event:")) eventName = line.substring(6).stripLeading();
                if (line.startsWith("data:")) {
                    if (!data.isEmpty()) data.append('\n');
                    data.append(line.substring(5).stripLeading());
                }
            }
            if (data.isEmpty()) return;
            if ("[DONE]".contentEquals(data)) { completed = true; return; }
            try {
                JsonNode event = json.readTree(data.toString());
                String type = event.path("type").asText(eventName);
                if ("error".equals(type) || "response.failed".equals(type) || "response.incomplete".equals(type)) {
                    throw ChatGptException.unavailable();
                }
                if ("response.output_text.delta".equals(type)) {
                    String delta = event.path("delta").asText("");
                    if (answer.length() + delta.length() > MAX_ANSWER_CHARS) throw tooLarge();
                    answer.append(delta);
                }
                if ("response.completed".equals(type)) completed = true;
            } catch (ChatGptException error) {
                throw error;
            } catch (Exception ignored) {
                throw ChatGptException.unavailable();
            }
        }
    }

    private Mono<JsonNode> jsonResponse(ClientResponse response) {
        return response.statusCode().is2xxSuccessful() ? response.bodyToMono(JsonNode.class) : failure(response);
    }

    private <T> Mono<T> failure(ClientResponse response) {
        return response.releaseBody().then(Mono.error(upstreamError(response.statusCode().value())));
    }

    private ChatGptException upstreamError(int status) {
        return switch (status) {
            case 401, 403 -> new ChatGptException("unauthorized", 409, "ChatGPT authorization or access expired. Connect again and check your account access.");
            case 429 -> new ChatGptException("rate_limited", 429, "ChatGPT request limit reached. Wait before trying again.");
            default -> ChatGptException.unavailable();
        };
    }

    private <T> Mono<T> safe(Mono<T> operation, Duration timeout) {
        return operation.timeout(timeout).switchIfEmpty(Mono.error(ChatGptException.unavailable()))
                .onErrorMap(error -> error instanceof ChatGptException ? error : ChatGptException.unavailable());
    }

    private String required(JsonNode value, String field, int max) {
        String result = value.path(field).asText("");
        if (result.isBlank() || result.length() > max) throw ChatGptException.unavailable();
        return result;
    }

    private static int bounded(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }
    private static ChatGptException expired() { return new ChatGptException("expired", 410, "The device code expired. Connect again."); }
    private static ChatGptException tooLarge() { return new ChatGptException("response_too_large", 502, "The answer exceeded the limit. Ask a shorter question."); }
}
