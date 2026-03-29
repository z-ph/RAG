package com.mark.knowledge.auth.app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mark.knowledge.auth.dto.LoginRequest;
import com.mark.knowledge.auth.dto.RegisterRequest;
import com.mark.knowledge.auth.dto.RegistrationCodeCreateRequest;
import com.mark.knowledge.auth.entity.RegistrationCode;
import com.mark.knowledge.auth.repository.RegistrationCodeRepository;
import com.mark.knowledge.auth.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Autowired
    private RegistrationCodeRepository registrationCodeRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @BeforeEach
    void setUp() {
        registrationCodeRepository.deleteAll();
        userAccountRepository.findAll().stream()
            .filter(userAccount -> !"admin".equals(userAccount.getUsername()))
            .forEach(userAccountRepository::delete);
    }

    @Test
    void shouldRequireAuthenticationForDocumentsAndKeepRagPublic() throws Exception {
        mockMvc.perform(get("/api/documents"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("未登录"));

        mockMvc.perform(get("/api/rag/health"))
            .andExpect(status().isOk());
    }

    @Test
    void shouldExposeCurrentUserAfterLogin() throws Exception {
        MockHttpSession session = loginAsAdmin();

        mockMvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.user.username").value("admin"))
            .andExpect(jsonPath("$.user.role").value("ADMIN"));
    }

    @Test
    void shouldConsumeRegistrationCodeOnlyOnce() throws Exception {
        MockHttpSession adminSession = loginAsAdmin();
        String code = createCode(adminSession, LocalDateTime.now().plusDays(1));

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegisterRequest("user1", "Password123", code))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.user.username").value("user1"));

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegisterRequest("user2", "Password123", code))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("注册码已使用"));
    }

    @Test
    void shouldDisableAndDeleteRegistrationCode() throws Exception {
        MockHttpSession adminSession = loginAsAdmin();
        String responseBody = mockMvc.perform(post("/api/auth/registration-codes")
                .session(adminSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegistrationCodeCreateRequest("manual-disable", LocalDateTime.now().plusDays(1)))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        JsonNode createdCode = objectMapper.readTree(responseBody);
        Long id = createdCode.get("id").asLong();
        String code = createdCode.get("code").asText();

        mockMvc.perform(patch("/api/auth/registration-codes/{id}/disable", id).session(adminSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DISABLED"));

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegisterRequest("user3", "Password123", code))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("注册码已被禁用"));

        mockMvc.perform(delete("/api/auth/registration-codes/{id}", id).session(adminSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("注册码已删除"));
    }

    @Test
    void shouldRejectExpiredRegistrationCode() throws Exception {
        registrationCodeRepository.save(new RegistrationCode(
            "EXPD-TEST-CODE",
            "expired",
            "admin",
            LocalDateTime.now().minusMinutes(1)
        ));

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegisterRequest("user4", "Password123", "EXPD-TEST-CODE"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("注册码已过期"));
    }

    private MockHttpSession loginAsAdmin() throws Exception {
        MvcResult mvcResult = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("admin", "ChangeMe123!"))))
            .andExpect(status().isOk())
            .andReturn();
        return (MockHttpSession) mvcResult.getRequest().getSession(false);
    }

    private String createCode(MockHttpSession adminSession, LocalDateTime expiresAt) throws Exception {
        String responseBody = mockMvc.perform(post("/api/auth/registration-codes")
                .session(adminSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegistrationCodeCreateRequest("invite", expiresAt))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("AVAILABLE"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(responseBody).get("code").asText();
    }
}
