package com.example.lms.config.demo;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration(proxyBeanMethods = false)
@Profile("demo")
public class DemoSafetyConfiguration {
    @Bean
    static BeanFactoryPostProcessor demoConfigurationGuard(Environment environment) {
        // Runs before datasource/Flyway instantiation, not after migrations have started.
        return beanFactory -> validate(environment);
    }

    static void validate(Environment environment) {
        if (!environment.acceptsProfiles(Profiles.of("prod & !dev"))) {
            throw new IllegalStateException("Demo requires SPRING_PROFILES_ACTIVE=prod,demo.");
        }
        if (!"isolated-demo-only".equals(environment.getProperty("app.demo.database-ack"))) {
            throw new IllegalStateException("Set DEMO_DATABASE_ACK=isolated-demo-only only for a new demo database.");
        }
        String password = environment.getProperty("app.demo.student-password", "");
        if (password.length() < 24 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("DEMO_STUDENT_PASSWORD must contain at least 24 characters and at most 72 UTF-8 bytes.");
        }
        for (String property : List.of("app.auth.google.enabled", "app.auth.google.redirect-flow-enabled",
                "app.video.ingest.enabled", "app.sepay.enabled", "chatgpt.enabled", "wiii.webhook.enabled",
                "cloudflare.r2.enabled", "cloudflare.stream.enabled", "spring.kafka.enabled")) {
            if (environment.getProperty(property, Boolean.class, false)) {
                throw new IllegalStateException("Demo requires " + property + "=false.");
            }
        }
        for (String property : List.of("gotenberg.url", "wiii.webhook.secret", "wiii.service-token")) {
            if (!environment.getProperty(property, "").isBlank()) {
                throw new IllegalStateException("Demo requires " + property + " to be empty.");
            }
        }
    }
}
