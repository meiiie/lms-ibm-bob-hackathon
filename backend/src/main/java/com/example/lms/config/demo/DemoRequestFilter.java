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
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Additional restrictions for the intentionally shared, student-only public demo. */
@Component
@Profile("demo")
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class DemoRequestFilter extends OncePerRequestFilter {
    private static final Set<String> AUTH_POSTS = Set.of("/api/v3/auth/login", "/api/v3/auth/lookup",
            "/api/v3/auth/refresh", "/api/v3/auth/logout");
    private static final Set<String> AUTH_GETS = Set.of("/api/v3/auth/me", "/api/v3/auth/google/config");
    private static final Set<String> AI_GETS = Set.of("/api/v3/ai/health", "/api/v3/ai/chatgpt/status");
    private static final List<String> BLOCKED_TREES = List.of("/api/v3/admin", "/api/v3/teacher",
            "/api/v3/integration", "/api/v3/invites", "/api/v3/files", "/api/v3/document-previews");

    private final DemoReadiness readiness;

    public DemoRequestFilter(DemoReadiness readiness) { this.readiness = readiness; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!readiness.isReady()) {
            reject(response, 503, "demo_starting", "The demo is preparing its synthetic data. Please retry shortly.");
            return;
        }
        if (blocked(request)) {
            reject(response, 403, "demo_restricted", "This action is disabled in the shared learning demo.");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean blocked(HttpServletRequest request) {
        // MVC decodes path segments after this filter. API IDs are plain UUIDs;
        // reject encoded paths so an encoded "auth" cannot bypass the shared-account guard.
        if (request.getRequestURI().contains("%")) return true;
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String method = request.getMethod();
        if ("OPTIONS".equals(method)) return false;
        // Spring Security still authenticates/authorizes all requests that pass this guard.
        if (BLOCKED_TREES.stream().anyMatch(root -> within(path, root))) return true;
        String contentType = request.getContentType();
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("multipart/")) return true;
        if (within(path, "/api/v3/auth")) {
            return !("POST".equals(method) && AUTH_POSTS.contains(path))
                    && !("GET".equals(method) && AUTH_GETS.contains(path));
        }
        if (within(path, "/api/v3/ai")) return !("GET".equals(method) && AI_GETS.contains(path));
        if (within(path, "/api/v3/payments")) {
            // The lesson player needs the read-only access checks; no checkout or gateway callback runs.
            return !("GET".equals(method) && (path.startsWith("/api/v3/payments/status/")
                    || path.startsWith("/api/v3/payments/can-access/")
                    || path.equals("/api/v3/payments/available-methods")
                    || path.equals("/api/v3/payments/my-payments")));
        }
        boolean writes = !"GET".equals(method) && !"HEAD".equals(method);
        return writes && (within(path, "/api/v3/users") || within(path, "/api/v3/organizations"));
    }

    private static boolean within(String path, String root) {
        return path.equals(root) || path.startsWith(root + "/");
    }

    private static void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"success\":false,\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
