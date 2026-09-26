package com.example.lms.ai_assistant.infrastructure.web;

import com.example.lms.ai_assistant.infrastructure.chatgpt.ChatGptSessionService;
import com.example.lms.identity.infrastructure.persistence.entity.UserJpaEntity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ChatGptControllerV3Test {
    ChatGptSessionService sessions;
    MockMvc mvc;
    UUID owner = UUID.randomUUID();

    @BeforeEach
    void setup() {
        sessions = mock(ChatGptSessionService.class);
        mvc = MockMvcBuilders.standaloneSetup(new ChatGptControllerV3(sessions))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        SecurityContextHolder.clearContext();
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void everyEndpointRejectsMissingPrincipalWithNoStore() throws Exception {
        mvc.perform(get("/api/v3/ai/chatgpt/status")).andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post("/api/v3/ai/chatgpt/device")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v3/ai/chatgpt/poll").contentType("application/json").content("{\"attemptId\":\"x\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v3/ai/chatgpt/ask").contentType("application/json").content("{\"question\":\"x\"}")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v3/ai/chatgpt/connection")).andExpect(status().isUnauthorized());
        verifyNoInteractions(sessions);
    }

    @Test
    void requestCannotChooseAnotherOwner() throws Exception {
        signIn();
        when(sessions.ask(eq(owner), eq("Study question"))).thenReturn("Plain answer");
        mvc.perform(post("/api/v3/ai/chatgpt/ask").contentType("application/json")
                        .content("{\"question\":\"Study question\",\"userId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.answer").value("Plain answer"));
        verify(sessions).ask(owner, "Study question");
    }

    @Test
    void statusAndMalformedRequestsAreNeverCacheable() throws Exception {
        signIn();
        when(sessions.status(owner)).thenReturn(new ChatGptSessionService.Status(false, "disconnected", null, null, null, null, null));
        mvc.perform(get("/api/v3/ai/chatgpt/status")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store")).andExpect(jsonPath("$.data.enabled").value(false));
        mvc.perform(post("/api/v3/ai/chatgpt/ask").contentType("application/json").content("{broken"))
                .andExpect(status().isBadRequest()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.error.code").value("invalid_request"));
    }

    private void signIn() {
        UserJpaEntity principal = mock(UserJpaEntity.class);
        when(principal.getId()).thenReturn(owner);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }
}
