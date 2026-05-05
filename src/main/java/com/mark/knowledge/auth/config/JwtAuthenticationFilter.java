package com.mark.knowledge.auth.config;

import com.mark.knowledge.auth.service.JwtUtil;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtUtil jwtUtil;

    public JwtAuthenticationFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            var claims = jwtUtil.parseToken(token);

            // Reject refresh tokens used as access tokens
            if (jwtUtil.isRefreshToken(claims)) {
                filterChain.doFilter(request, response);
                return;
            }

            String username = claims.getSubject();
            @SuppressWarnings("unchecked")
            List<String> authorityStrings = claims.get("authorities", List.class);

            List<SimpleGrantedAuthority> authorities = authorityStrings.stream()
                .map(SimpleGrantedAuthority::new)
                .toList();

            var authentication = UsernamePasswordAuthenticationToken.authenticated(
                username, null, authorities);

            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);

        } catch (JwtException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
