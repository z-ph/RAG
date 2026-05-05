package com.mark.knowledge.config;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoggingFilterTest {

    @Test
    void shouldPassThroughSseResponseWithoutBuffering() throws Exception {
        LoggingFilter filter = new LoggingFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/rag/ask/stream");
        request.addHeader("Accept", MediaType.TEXT_EVENT_STREAM_VALUE);
        MockHttpServletResponse response = new MockHttpServletResponse();

        FilterChain chain = (req, res) -> {
            HttpServletResponse httpResponse = (HttpServletResponse) res;
            httpResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
            httpResponse.getWriter().write("event:start\n");
            httpResponse.getWriter().write("data:{\"conversationId\":\"test-1\"}\n\n");
        };

        filter.doFilter(request, response, chain);

        assertEquals("event:start\ndata:{\"conversationId\":\"test-1\"}\n\n", response.getContentAsString());
        assertEquals(MediaType.TEXT_EVENT_STREAM_VALUE, response.getContentType());
    }

    @Test
    void shouldLogStructuredNetworkEntryForRegularRequests() throws Exception {
        LoggingFilter filter = new LoggingFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/documents");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Logger logger = (Logger) LoggerFactory.getLogger("network");
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            FilterChain chain = (req, res) -> {
                HttpServletResponse httpResponse = (HttpServletResponse) res;
                httpResponse.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                httpResponse.getWriter().write("{\"message\":\"boom\"}");
            };

            filter.doFilter(request, response, chain);

            assertEquals(500, response.getStatus());
            assertEquals("{\"message\":\"boom\"}", response.getContentAsString());
            assertFalse(appender.list.isEmpty());

            String message = appender.list.getLast().getFormattedMessage();
            assertTrue(message.contains("\"method\":\"GET\""));
            assertTrue(message.contains("\"uri\":\"/documents\""));
            assertTrue(message.contains("\"status\":500"));
            assertFalse(message.contains("responseBody"));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }
}
