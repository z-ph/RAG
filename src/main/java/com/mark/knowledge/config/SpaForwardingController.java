package com.mark.knowledge.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.server.ResponseStatusException;

/**
 * 将非 API 的前端路由转发到单页应用入口。
 */
@Controller
public class SpaForwardingController {

    @GetMapping({"/", "/{path:[^\\.]*}", "/**/{path:[^\\.]*}"})
    public String forward(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String accept = request.getHeader(HttpHeaders.ACCEPT);

        if (requestUri.startsWith("/api")
                || requestUri.startsWith("/error")
                || !acceptsHtml(accept)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        return "forward:/index.html";
    }

    private boolean acceptsHtml(String accept) {
        if (accept == null || accept.isBlank()) {
            return false;
        }

        return accept.contains(MediaType.TEXT_HTML_VALUE) || accept.contains(MediaType.ALL_VALUE);
    }
}
