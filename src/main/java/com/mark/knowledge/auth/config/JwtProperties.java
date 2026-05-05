package com.mark.knowledge.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.jwt")
public record JwtProperties(
    String secret,
    long accessExpiration,
    long refreshExpiration
) {
}
