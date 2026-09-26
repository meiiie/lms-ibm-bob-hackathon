package com.example.lms.config.demo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DemoRequestFilterTest {
    @Test
    void encodedAuthPathCannotReachDecodedMvcHandler() throws Exception {
        var controller = new PasswordHandler();
        var mvc = MockMvcBuilders.standaloneSetup(controller).addFilters(readyFilter()).build();
        mvc.perform(put(URI.create("/api/v3/%61uth/password"))).andExpect(status().isForbidden());
        assertThat(controller.reached).isFalse();
    }

    @Test
    void encodedSearchQueryStillPassesToExistingAuthorization() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/v3/courses");
        request.setQueryString("search=life%20raft");
        var chain = new MockFilterChain();
        readyFilter().doFilter(request, new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isSameAs(request);
    }

    @RestController
    static class PasswordHandler {
        boolean reached;
        @PutMapping("/api/v3/auth/password")
        void password() { reached = true; }
    }

    @Test
    void rejectsRequestsIncludingHealthUntilDataTransactionHasCommitted() throws Exception {
        var readiness = new DemoReadiness();
        var filter = new DemoRequestFilter(readiness);
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(new MockHttpServletRequest("GET", "/actuator/health"), response, chain);
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(chain.getRequest()).isNull();
        readiness.markReady();
        filter.doFilter(new MockHttpServletRequest("GET", "/actuator/health"), new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isNotNull();
    }

    @ParameterizedTest
    @CsvSource({"POST,/api/v3/auth/register", "PUT,/api/v3/auth/profile", "PUT,/api/v3/auth/password",
            "POST,/api/v3/auth/forgot-password", "POST,/api/v3/auth/reset-password",
            "GET,/api/v3/auth/google/authorize", "GET,/api/v3/admin/settings",
            "POST,/api/v3/teacher/courses", "POST,/api/v3/integration/courses/generate",
            "POST,/api/v3/invites/accept", "POST,/api/v3/files/upload", "DELETE,/api/v3/files",
            "POST,/api/v3/document-previews", "POST,/api/v3/ai/token", "POST,/api/v3/ai/chat/stream",
            "POST,/api/v3/ai/chatgpt/device", "POST,/api/v3/ai/chatgpt/ask",
            "POST,/api/v3/payments/checkout", "GET,/api/v3/payments/vnpay-ipn",
            "GET,/api/v3/payments/vnpay-return", "POST,/api/v3/payments/sepay/webhook",
            "PUT,/api/v3/users/demo-user", "POST,/api/v3/organizations/org/members"})
    void preventsSharedAccountChangesAndExternalSideEffects(String method, String path) throws Exception {
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        readyFilter().doFilter(new MockHttpServletRequest(method, path), response, chain);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("demo_restricted");
        assertThat(chain.getRequest()).isNull();
    }

    @ParameterizedTest
    @CsvSource({"POST,/api/v3/auth/login", "POST,/api/v3/auth/lookup", "POST,/api/v3/auth/refresh",
            "GET,/api/v3/auth/me", "GET,/api/v3/auth/google/config", "POST,/api/v3/auth/logout",
            "GET,/api/v3/ai/health", "GET,/api/v3/ai/chatgpt/status",
            "GET,/api/v3/student/courses/enrolled", "GET,/api/v3/courses/course/content",
            "GET,/api/v3/payments/status/course", "GET,/api/v3/payments/can-access/course/lesson/0",
            "GET,/api/v3/payments/available-methods", "POST,/api/v3/sync/push", "GET,/api/v3/sync/pull",
            "POST,/api/v3/student/progress/lessons/lesson/complete",
            "POST,/api/v3/quizzes/quiz/attempts/start", "PUT,/api/v3/quizzes/attempts/attempt/save",
            "POST,/api/v3/quizzes/attempts/attempt/submit", "OPTIONS,/api/v3/auth/register"})
    void keepsAuthenticationLearningQuizAndOfflineSyncRoutes(String method, String path) throws Exception {
        var request = new MockHttpServletRequest(method, path);
        var chain = new MockFilterChain();
        readyFilter().doFilter(request, new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isSameAs(request);
    }

    @Test
    void rejectsMultipartUploadsOutsideFileControllerToo() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/v3/assignments/assignment/submit");
        request.setContentType("Multipart/Form-Data; boundary=example");
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        readyFilter().doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void restrictionsAlsoApplyWhenHostedUnderContextPath() throws Exception {
        var request = new MockHttpServletRequest("POST", "/demo/api/v3/auth/register");
        request.setContextPath("/demo");
        var response = new MockHttpServletResponse();
        readyFilter().doFilter(request, response, new MockFilterChain());
        assertThat(response.getStatus()).isEqualTo(403);
    }

    private DemoRequestFilter readyFilter() {
        var readiness = new DemoReadiness();
        readiness.markReady();
        return new DemoRequestFilter(readiness);
    }
}
