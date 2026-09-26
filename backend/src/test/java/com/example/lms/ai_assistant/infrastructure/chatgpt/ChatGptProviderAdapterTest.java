package com.example.lms.ai_assistant.infrastructure.chatgpt;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.web.reactive.function.BodyInserter;
import org.springframework.web.reactive.function.server.HandlerStrategies;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

/** Mocked provider transport: these tests do not prove live account connectivity. */
class ChatGptProviderAdapterTest {
    private final ObjectMapper json = new ObjectMapper();
    private final ChatGptProvider.Credential credential = new ChatGptProvider.Credential("secret-token", "account-id", 3600);
    private final ChatGptProvider.Device device = new ChatGptProvider.Device("device-secret", "ABCD", 5, 900);

    @Test
    void deviceUsesFixedEndpointAndBoundsMetadata() {
        var provider = adapter(request -> {
            assertThat(request.url().toString()).isEqualTo("https://auth.openai.com/api/accounts/deviceauth/usercode");
            return reply(200, "{\"device_auth_id\":\"private-device\",\"usercode\":\"SAFE-CODE\",\"interval\":1,\"expires_in\":99999}");
        });
        var result = provider.start().block();
        assertThat(result.intervalSeconds()).isEqualTo(5);
        assertThat(result.expiresInSeconds()).isEqualTo(900);
        assertThat(result.userCode()).isEqualTo("SAFE-CODE");
        assertThat(result.toString()).doesNotContain("private-device");
    }

    @Test
    void deviceSuccessExchangesCodeAndDiscardsRefreshToken() {
        AtomicInteger calls = new AtomicInteger();
        var provider = adapter(request -> calls.getAndIncrement() == 0
                ? reply(200, "{\"authorization_code\":\"code\",\"code_verifier\":\"verifier\"}")
                : reply(200, "{\"access_token\":\"secret-access\",\"refresh_token\":\"secret-refresh\",\"expires_in\":99999}"));
        var result = provider.poll(device).block();
        assertThat(result.credential().accessToken()).isEqualTo("secret-access");
        assertThat(result.credential().expiresInSeconds()).isEqualTo(3600);
        assertThat(result.toString()).doesNotContain("secret");
        assertThat(calls).hasValue(2);
    }

    @Test
    void pollingDistinguishesPendingSlowDownExpired() {
        assertThat(adapter(r -> reply(404, "private error")).poll(device).block().credential()).isNull();
        assertThat(adapter(r -> reply(400, "{\"error\":\"authorization_pending\"}")).poll(device).block().credential()).isNull();
        assertThat(adapter(r -> reply(400, "{\"error\":\"slow_down\"}")).poll(device).block().slowDown()).isTrue();
        assertCode(() -> adapter(r -> reply(400, "{\"error\":\"expired_token\"}")).poll(device).block(), "expired");
    }

    @Test
    void responsesUseRequiredVersionRoutingHeadersAndUtf8ChunkBoundaries() {
        String stream = "event: response.output_text.delta\r\ndata: {\"delta\":\"Thủy thủ ⚓\"}\r\n\r\n"
                + "data: {\"type\":\"response.completed\",\"response\":{\"output\":[]}}";
        byte[] bytes = stream.getBytes(StandardCharsets.UTF_8);
        var provider = adapter(request -> {
            assertThat(request.url().toString()).isEqualTo(ChatGptProviderAdapter.RESPONSES);
            assertThat(request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer secret-token");
            assertThat(request.headers().getFirst("chatgpt-account-id")).isEqualTo("account-id");
            assertThat(request.headers().getFirst("originator")).isEqualTo("codex_cli_rs");
            var captured = new MockClientHttpRequest(request.method(), request.url());
            captured.getHeaders().addAll(request.headers());
            request.body().insert(captured, new BodyInserter.Context() {
                @Override public List<org.springframework.http.codec.HttpMessageWriter<?>> messageWriters() { return HandlerStrategies.withDefaults().messageWriters(); }
                @Override public Optional<org.springframework.http.server.reactive.ServerHttpRequest> serverRequest() { return Optional.empty(); }
                @Override public Map<String, Object> hints() { return Map.of(); }
            }).block();
            try {
                var body = json.readTree(captured.getBodyAsString().block());
                assertThat(body.path("model").asText()).isEqualTo("gpt-5.4-mini");
                assertThat(body.path("input").isArray()).isTrue();
                assertThat(body.path("input").get(0).path("content").get(0).path("text").asText()).isEqualTo("Question");
                assertThat(body.path("store").asBoolean(true)).isFalse();
                assertThat(body.path("stream").asBoolean()).isTrue();
                assertThat(body.path("parallel_tool_calls").asBoolean(true)).isFalse();
                assertThat(body.has("tools")).isFalse();
                assertThat(body.has("max_output_tokens")).isFalse();
            } catch (java.io.IOException error) {
                throw new AssertionError("Invalid request JSON", error);
            }
            return Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", "text/event-stream")
                    .body(Flux.range(0, bytes.length).map(i -> DefaultDataBufferFactory.sharedInstance.wrap(new byte[]{bytes[i]})))
                    .build());
        });
        assertThat(provider.ask(credential, "Question").block()).isEqualTo("Thủy thủ ⚓");
    }

    @Test
    void outputLimitsCancelUpstreamAndDiscardAnswer() {
        AtomicBoolean cancelled = new AtomicBoolean();
        var provider = adapter(request -> Mono.just(ClientResponse.create(HttpStatus.OK)
                .body(Flux.<org.springframework.core.io.buffer.DataBuffer>just(DefaultDataBufferFactory.sharedInstance.wrap(new byte[ChatGptProviderAdapter.MAX_STREAM_BYTES + 1]))
                        .concatWith(Flux.never()).doOnCancel(() -> cancelled.set(true))).build()));
        assertCode(() -> provider.ask(credential, "Question").block(), "response_too_large");
        assertThat(cancelled).isTrue();
        assertCode(() -> provider.parseAnswer("data: {\"type\":\"response.output_text.delta\",\"delta\":\"" + "x".repeat(20001) + "\"}\n\n"), "response_too_large");
    }

    @Test
    void partialFailedAndMalformedStreamsNeverMasqueradeAsSuccess() {
        var provider = adapter(r -> reply(500, "private body"));
        assertCode(() -> provider.parseAnswer("data: {\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\n"), "unavailable");
        assertCode(() -> provider.parseAnswer("data: {\"type\":\"response.failed\",\"secret\":\"hidden\"}\n\n"), "unavailable");
        assertCode(() -> provider.parseAnswer("data: {bad-json-secret}\n\n"), "unavailable");
    }

    @Test
    void providerErrorsAndTimeoutsNeverExposeBodiesOrTokens() {
        for (int status : new int[]{401, 403, 429, 500}) {
            String code = status == 429 ? "rate_limited" : status == 500 ? "unavailable" : "unauthorized";
            assertCode(() -> adapter(r -> reply(status, "access_token=secret-token")).ask(credential, "question").block(), code);
        }
        AtomicBoolean cancelled = new AtomicBoolean();
        var provider = new ChatGptProviderAdapter(WebClient.builder()
                .exchangeFunction(r -> Mono.<ClientResponse>never().doOnCancel(() -> cancelled.set(true))).build(),
                json, "gpt-5.4-mini", Duration.ofMillis(25), Duration.ofMillis(25));
        assertCode(() -> provider.start().block(), "unavailable");
        assertThat(cancelled).isTrue();
    }

    private ChatGptProviderAdapter adapter(ExchangeFunction transport) {
        return new ChatGptProviderAdapter(WebClient.builder().codecs(c -> c.defaultCodecs().maxInMemorySize(65536))
                .exchangeFunction(transport).build(), json, "gpt-5.4-mini", Duration.ofSeconds(5), Duration.ofSeconds(5));
    }
    private Mono<ClientResponse> reply(int status, String body) {
        return Mono.just(ClientResponse.create(HttpStatus.valueOf(status)).header("Content-Type", "application/json").body(body).build());
    }
    private void assertCode(Runnable operation, String code) {
        assertThatThrownBy(operation::run).isInstanceOfSatisfying(ChatGptException.class, error -> {
            assertThat(error.code()).isEqualTo(code);
            assertThat(error.getMessage()).doesNotContain("secret", "private", "hidden");
            assertThat(error.getCause()).isNull();
        });
    }
}
