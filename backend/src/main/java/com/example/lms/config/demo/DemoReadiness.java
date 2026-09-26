package com.example.lms.config.demo;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("demo")
public class DemoReadiness {
    private volatile boolean ready;

    public boolean isReady() { return ready; }

    void markReady() { ready = true; }
}
