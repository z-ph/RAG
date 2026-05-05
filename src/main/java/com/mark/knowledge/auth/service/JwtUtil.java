package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long accessExpiration;
    private final long refreshExpiration;

    public JwtUtil(JwtProperties properties) {
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes());
        this.accessExpiration = properties.accessExpiration();
        this.refreshExpiration = properties.refreshExpiration();
    }

    public String generateAccessToken(String username, Long userId, String roleCode, List<String> authorities) {
        Date now = new Date();
        return Jwts.builder()
            .subject(username)
            .claims(Map.of(
                "userId", userId,
                "roleCode", roleCode,
                "authorities", authorities
            ))
            .issuedAt(now)
            .expiration(new Date(now.getTime() + accessExpiration))
            .signWith(key)
            .compact();
    }

    public String generateRefreshToken(String username) {
        Date now = new Date();
        String jti = UUID.randomUUID().toString();
        return Jwts.builder()
            .subject(username)
            .claims(Map.of(
                "type", "refresh",
                "jti", jti
            ))
            .issuedAt(now)
            .expiration(new Date(now.getTime() + refreshExpiration))
            .signWith(key)
            .compact();
    }

    public Claims parseToken(String token) throws ExpiredJwtException, JwtException {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public boolean isRefreshToken(Claims claims) {
        return "refresh".equals(claims.get("type", String.class));
    }

    public String getJti(Claims claims) {
        return claims.get("jti", String.class);
    }
}
