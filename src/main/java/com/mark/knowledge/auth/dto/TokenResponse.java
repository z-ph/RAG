package com.mark.knowledge.auth.dto;

public record TokenResponse(
    String accessToken,
    String refreshToken
) {
}
