package com.mark.knowledge.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SpaForwardingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldServeFrontendEntryPointForRootRequest() throws Exception {
        mockMvc.perform(get("/").accept(MediaType.TEXT_HTML))
            .andExpect(status().isOk())
            .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void shouldForwardNestedFrontendRouteToIndexHtml() throws Exception {
        mockMvc.perform(get("/workspace/chat").accept(MediaType.TEXT_HTML))
            .andExpect(status().isOk())
            .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void shouldNotForwardUnknownApiRoute() throws Exception {
        mockMvc.perform(get("/api/unknown").accept(MediaType.TEXT_HTML))
            .andExpect(status().isNotFound());
    }

    @Test
    void shouldNotForwardAssetLikePath() throws Exception {
        mockMvc.perform(get("/assets/main.js").accept(MediaType.TEXT_HTML))
            .andExpect(status().isNotFound());
    }
}
