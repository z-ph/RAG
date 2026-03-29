package com.mark.knowledge.auth.dto;

import java.util.List;

/**
 * 注册码列表响应。
 */
public record RegistrationCodeListResponse(
    List<RegistrationCodeResponse> codes,
    int total
) {
}
