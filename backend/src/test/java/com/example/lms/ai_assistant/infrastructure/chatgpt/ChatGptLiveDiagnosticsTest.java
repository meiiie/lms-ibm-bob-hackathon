package com.example.lms.ai_assistant.infrastructure.chatgpt;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** Mock transport only: no device flow, credentials or external requests are used. */
@ExtendWith(OutputCaptureExtension.class)
class ChatGptLiveDiagnosticsTest {
    @Test
    void observesOneSubscriptionWithoutChangingTheStreamOrPrintingAnswer(CapturedOutput output) {
        String stream = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"fixture-private-answer\"}\n\n"
                + "data: {\"type\":\"fixture-private-event-type\"}\n\n"
                + "data: [DONE]\n\n";
        AtomicInteger subscriptions = new AtomicInteger();

        assertThat(read("https://chatgpt.com/backend-api/codex/responses", stream,
                "text/event-stream", subscriptions)).isEqualTo(stream);

        assertThat(subscriptions).hasValue(1);
        assertThat(output.getOut()).contains("text/event-stream", "response.output_text.delta", "other",
                        "textDeltaPresent=true", "doneMarker=true")
                .doesNotContain("fixture-private-answer", "fixture-private-event-type", "fixture-bearer-secret");
    }

    @Test
    void neverObservesCredentialResponsesOrHeaders(CapturedOutput output) {
        String credentials = "{\"access_token\":\"fixture-access-secret\","
                + "\"refresh_token\":\"fixture-refresh-secret\",\"id_token\":\"fixture-id-secret\"}";
        AtomicInteger subscriptions = new AtomicInteger();

        assertThat(read("https://auth.openai.com/oauth/token", credentials,
                "application/json", subscriptions)).isEqualTo(credentials);

        assertThat(subscriptions).hasValue(1);
        assertThat(output.getOut()).doesNotContain("Diagnostic", "fixture-access-secret",
                "fixture-refresh-secret", "fixture-id-secret", "fixture-bearer-secret");
    }

    @Test
    void printsOnlyAllowlistedErrorCodesAndNeverProviderProse(CapturedOutput output) {
        String response = "{\"error\":{\"code\":\"model_not_found\","
                + "\"type\":\"fixture-private-error-type\",\"message\":\"fixture-private-provider-message\"}}";
        AtomicInteger subscriptions = new AtomicInteger();

        assertThat(read("https://chatgpt.com/backend-api/codex/responses", response,
                "application/json", subscriptions)).isEqualTo(response);

        assertThat(output.getOut()).contains("errorCodes=[model_not_found]")
                .doesNotContain("fixture-private-error-type", "fixture-private-provider-message", "fixture-bearer-secret");
        assertThat(subscriptions).hasValue(1);
    }

    @Test
    void boundsItsSnapshotWithoutTruncatingTheConsumersBody(CapturedOutput output) {
        String response = "fixture-private-body-".repeat(15_000);
        AtomicInteger subscriptions = new AtomicInteger();

        assertThat(read("https://chatgpt.com/backend-api/codex/responses", response,
                "text/plain", subscriptions)).isEqualTo(response);

        assertThat(response.length()).isGreaterThan(ChatGptProviderAdapter.MAX_STREAM_BYTES);
        assertThat(subscriptions).hasValue(1);
        assertThat(output.getOut()).contains("capturedBytes=" + ChatGptProviderAdapter.MAX_STREAM_BYTES)
                .doesNotContain("fixture-private-body", "fixture-bearer-secret");
    }

    private String read(String uri, String body, String contentType, AtomicInteger subscriptions) {
        Flux<DataBuffer> source = Flux.defer(() -> {
            subscriptions.incrementAndGet();
            return Flux.<DataBuffer>just(DefaultDataBufferFactory.sharedInstance.wrap(body.getBytes(StandardCharsets.UTF_8)));
        });
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(1_048_576)).build();
        WebClient client = WebClient.builder()
                .exchangeStrategies(strategies)
                .filter(new ChatGptLiveDiagnostics().filter())
                .exchangeFunction(request -> Mono.just(ClientResponse.create(org.springframework.http.HttpStatus.OK, strategies)
                        .header("Content-Type", contentType).body(source).build()))
                .build();
        return client.post().uri(uri).header("Authorization", "Bearer fixture-bearer-secret")
                .retrieve().bodyToMono(String.class).block(Duration.ofSeconds(2));
    }
}
