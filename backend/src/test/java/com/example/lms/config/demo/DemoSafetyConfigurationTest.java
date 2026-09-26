package com.example.lms.config.demo;

import com.example.lms.learning_delivery.infrastructure.service.VideoPipelineHealthIndicator;
import com.example.lms.shared.application.port.EmailServicePort;
import com.example.lms.shared.infrastructure.email.DemoEmailAdapter;
import com.example.lms.shared.infrastructure.email.ResendEmailAdapter;
import com.example.lms.shared.infrastructure.email.SmtpEmailAdapter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.env.MockEnvironment;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DemoSafetyConfigurationTest {
    @Test
    void intentionallyDisabledVideoPipelineDoesNotMakeDemoHealthDown() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.setEnvironment(validEnvironment());
            context.register(DemoSafetyConfiguration.class, VideoPipelineHealthIndicator.class);
            context.refresh();
            assertThat(context.getBeansOfType(VideoPipelineHealthIndicator.class)).isEmpty();
        }
    }

    @Test
    void normalProductionRetainsVideoHealthChecks() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("prod");
            context.register(VideoPipelineHealthIndicator.class);
            context.refresh();
            assertThat(context.getBeansOfType(VideoPipelineHealthIndicator.class)).hasSize(1);
        }
    }

    @Test
    void requiresAcknowledgementBeforeCreatingApplicationBeans() {
        var environment = validEnvironment();
        environment.setProperty("app.demo.database-ack", "");
        var created = new AtomicBoolean();
        try (var context = new AnnotationConfigApplicationContext()) {
            context.setEnvironment(environment);
            context.register(DemoSafetyConfiguration.class);
            context.registerBean("applicationBean", Object.class, () -> {
                created.set(true);
                return new Object();
            });
            assertThatThrownBy(context::refresh).hasMessageContaining("DEMO_DATABASE_ACK");
            assertThat(created).isFalse();
        }
    }

    @Test
    void doesNotActivateDemoComponentsOrValidationInNormalProduction() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("prod");
            context.register(DemoSafetyConfiguration.class, DemoReadiness.class, DemoEmailAdapter.class);
            context.refresh();
            assertThat(context.getBeansOfType(DemoReadiness.class)).isEmpty();
            assertThat(context.getBeansOfType(DemoEmailAdapter.class)).isEmpty();
        }
    }

    @Test
    void demoUsesOnlyNoOpEmailEvenWhenCombinedWithProduction() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.setEnvironment(validEnvironment());
            context.register(DemoSafetyConfiguration.class, DemoEmailAdapter.class,
                    ResendEmailAdapter.class, SmtpEmailAdapter.class);
            context.refresh();
            assertThat(context.getBeansOfType(EmailServicePort.class).values())
                    .singleElement().isInstanceOf(DemoEmailAdapter.class);
        }
    }

    @Test
    void rejectsDevOrMissingProductionProfile() {
        var environment = validEnvironment();
        environment.setActiveProfiles("demo");
        assertThatThrownBy(() -> DemoSafetyConfiguration.validate(environment)).hasMessageContaining("prod,demo");
        environment.setActiveProfiles("prod", "demo", "dev");
        assertThatThrownBy(() -> DemoSafetyConfiguration.validate(environment)).hasMessageContaining("prod,demo");
    }

    @Test
    void passwordValidationDoesNotExposePasswordAndAcceptsBoundedRandomValue() {
        var environment = validEnvironment();
        assertThatCode(() -> DemoSafetyConfiguration.validate(environment)).doesNotThrowAnyException();
        environment.setProperty("app.demo.student-password", "too-short-private");
        assertThatThrownBy(() -> DemoSafetyConfiguration.validate(environment))
                .hasMessageContaining("DEMO_STUDENT_PASSWORD").hasMessageNotContaining("too-short-private");
        environment.setProperty("app.demo.student-password", "é".repeat(37));
        assertThatThrownBy(() -> DemoSafetyConfiguration.validate(environment))
                .hasMessageContaining("72 UTF-8 bytes");
    }

    @ParameterizedTest
    @ValueSource(strings = {"app.auth.google.enabled", "app.auth.google.redirect-flow-enabled",
            "app.video.ingest.enabled", "app.sepay.enabled", "chatgpt.enabled", "wiii.webhook.enabled",
            "cloudflare.r2.enabled", "cloudflare.stream.enabled", "spring.kafka.enabled"})
    void refusesAccidentallyEnabledExternalIntegrations(String property) {
        var environment = validEnvironment().withProperty(property, "true");
        assertThatThrownBy(() -> DemoSafetyConfiguration.validate(environment)).hasMessageContaining(property);
    }

    @ParameterizedTest
    @ValueSource(strings = {"gotenberg.url", "wiii.webhook.secret", "wiii.service-token"})
    void refusesInheritedConnectionOrWiiiSecrets(String property) {
        var environment = validEnvironment().withProperty(property, "synthetic-forbidden-value");
        assertThatThrownBy(() -> DemoSafetyConfiguration.validate(environment)).hasMessageContaining(property)
                .hasMessageNotContaining("synthetic-forbidden-value");
    }

    private MockEnvironment validEnvironment() {
        var environment = new MockEnvironment()
                .withProperty("app.demo.database-ack", "isolated-demo-only")
                .withProperty("app.demo.student-password", "synthetic-test-password-24chars");
        environment.setActiveProfiles("prod", "demo");
        return environment;
    }
}
