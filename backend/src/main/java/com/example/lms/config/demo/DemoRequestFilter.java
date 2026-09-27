package com.example.lms.config.demo;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
/** Hold traffic until the initial demo transaction commits; normal LMS authorization applies afterwards. */
@Component
@Profile("demo")
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class DemoRequestFilter extends OncePerRequestFilter {
    private final DemoReadiness readiness;

    public DemoRequestFilter(DemoReadiness readiness) { this.readiness = readiness; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!readiness.isReady()) {
            reject(response, 503, "demo_starting", "The demo is preparing its synthetic data. Please retry shortly.");
            return;
        }
        chain.doFilter(request, response);
    }

    private static void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"success\":false,\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
