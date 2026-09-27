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
        for (String role : List.of("student", "teacher", "org-admin", "admin")) {
            String password = environment.getProperty("app.demo." + role + "-password", "");
            if (password.length() < 24 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
                throw new IllegalStateException("DEMO_" + role.toUpperCase(java.util.Locale.ROOT).replace('-', '_')
                        + "_PASSWORD must contain at least 24 characters and at most 72 UTF-8 bytes.");
            }
        }
    }
}
