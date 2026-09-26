package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;

/** Test-only diagnostics: never logs headers, raw bodies, response text or credential responses. */
final class ChatGptLiveDiagnostics {
    private static final Set<String> EVENT_TYPES = Set.of("response.created", "response.in_progress",
            "response.output_item.added", "response.output_item.done", "response.content_part.added",
            "response.content_part.done", "response.output_text.delta", "response.output_text.done",
            "response.completed", "response.failed", "response.incomplete", "response.reasoning_summary_part.added",
            "response.reasoning_summary_part.done", "response.reasoning_summary_text.delta", "response.reasoning_summary_text.done",
            "response.reasoning_text.delta", "response.reasoning_text.done", "error");
    private static final Set<String> ERROR_CODES = Set.of("model_not_found", "unsupported_model", "invalid_request_error",
            "invalid_request", "server_error", "rate_limit_exceeded", "usage_limit_reached", "insufficient_quota",
            "invalid_api_key", "token_expired", "unsupported_parameter", "missing_required_parameter",
            "invalid_parameter", "context_length_exceeded", "account_deactivated", "access_denied");
    private final ObjectMapper json = new ObjectMapper();

    WebClient client() {
        return WebClient.builder().codecs(c -> c.defaultCodecs().maxInMemorySize(65_536)).filter(filter()).build();
    }

    ExchangeFilterFunction filter() {
        return (request, next) -> next.exchange(request).doOnError(error -> {
            if (!request.url().getPath().endsWith("/codex/responses")) return;
            Throwable cause = error.getCause() == null ? error : error.getCause();
            String label = switch (cause.getClass().getSimpleName()) {
                case "ConnectTimeoutException", "ReadTimeoutException", "TimeoutException" -> "timeout";
                case "UnknownHostException" -> "dns";
                case "SSLHandshakeException", "SSLException" -> "tls";
                case "ConnectException", "PrematureCloseException" -> "connection";
                default -> "transport_other";
            };
            System.out.println("Diagnostic transport error category: " + label);
        }).map(response -> {
            if (!request.url().getPath().endsWith("/codex/responses")) return response;
            String type = response.headers().contentType().map(value -> {
                if (value.isCompatibleWith(org.springframework.http.MediaType.TEXT_EVENT_STREAM)) return "text/event-stream";
                if (value.isCompatibleWith(org.springframework.http.MediaType.APPLICATION_JSON)) return "application/json";
                return "other";
            }).orElse("absent");
            System.out.println("Diagnostic response: http=" + response.statusCode().value() + ", contentType=" + type);
            ByteArrayOutputStream snapshot = new ByteArrayOutputStream();
            return response.mutate().body(original -> original.doOnNext(buffer -> {
                // Copy only the bounded response stream, without consuming the adapter's bytes.
                int count = Math.min(buffer.readableByteCount(), ChatGptProviderAdapter.MAX_STREAM_BYTES - snapshot.size());
                for (int offset = 0; offset < count; offset++) snapshot.write(buffer.getByte(buffer.readPosition() + offset));
            }).doFinally(signal -> {
                System.out.println("Diagnostic stream termination: " + signal.name() + ", capturedBytes=" + snapshot.size());
                summarize(snapshot.toString(StandardCharsets.UTF_8));
            })).build();
        });
    }

    private void summarize(String text) {
        Set<String> events = new LinkedHashSet<>();
        Set<String> codes = new LinkedHashSet<>();
        int malformed = 0;
        boolean deltaSeen = false;
        boolean doneSeen = false;
        if (text.stripLeading().startsWith("{")) {
            try { collectCodes(json.readTree(text), codes); } catch (Exception ignored) { malformed++; }
        } else {
            for (String line : text.replace("\r\n", "\n").split("\n")) {
                if (!line.startsWith("data:")) continue;
                String data = line.substring(5).stripLeading();
                if (data.equals("[DONE]")) { doneSeen = true; continue; }
                try {
                    JsonNode event = json.readTree(data);
                    String eventType = event.path("type").asText("");
                    events.add(EVENT_TYPES.contains(eventType) ? eventType : "other");
                    deltaSeen |= event.path("delta").isTextual() && !event.path("delta").asText().isEmpty();
                    collectCodes(event, codes);
                } catch (Exception ignored) { malformed++; }
            }
        }
        System.out.println("Diagnostic stream: eventTypes=" + events + ", errorCodes=" + codes
                + ", textDeltaPresent=" + deltaSeen + ", doneMarker=" + doneSeen + ", malformedDataCount=" + malformed);
        // Fixed classifications only; never echo provider prose or any arbitrary field value.
        String lower = text.toLowerCase(java.util.Locale.ROOT);
        for (String hint : new String[]{"unsupported parameter", "missing query", "client_version", "model is not supported",
                "model not found", "instructions are required", "input must be a list", "account deactivated", "usage limit"}) {
            if (lower.contains(hint)) System.out.println("Diagnostic known hint: " + hint);
        }
        if (lower.contains("unsupported") || lower.contains("missing") || lower.contains("required")) {
            for (String field : new String[]{"model", "instructions", "input", "parallel_tool_calls", "store", "stream", "client_version"}) {
                if (lower.contains(field)) System.out.println("Diagnostic known parameter mentioned: " + field);
            }
        }
    }

    private void collectCodes(JsonNode node, Set<String> codes) {
        if (node.isObject()) {
            for (String name : new String[]{"code", "type"}) {
                String value = node.path(name).asText("");
                if (ERROR_CODES.contains(value)) codes.add(value);
            }
            for (String name : new String[]{"error", "response", "detail"}) {
                if (node.has(name)) collectCodes(node.path(name), codes);
            }
        }
    }
}
