package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.entity.RegistrationCode;
import com.mark.knowledge.auth.repository.RegistrationCodeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 注册码服务。
 */
@Service
public class RegistrationCodeService {

    private static final char[] CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RegistrationCodeRepository registrationCodeRepository;

    public RegistrationCodeService(RegistrationCodeRepository registrationCodeRepository) {
        this.registrationCodeRepository = registrationCodeRepository;
    }

    @Transactional(readOnly = true)
    public List<RegistrationCode> listCodes() {
        return registrationCodeRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public RegistrationCode createCode(String createdBy, String note, LocalDateTime expiresAt) {
        if (createdBy == null || createdBy.isBlank()) {
            throw new IllegalArgumentException("创建人不能为空");
        }
        if (expiresAt != null && !expiresAt.isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("有效期必须晚于当前时间");
        }

        RegistrationCode registrationCode = new RegistrationCode(
            generateUniqueCode(),
            trimToNull(note),
            createdBy,
            expiresAt
        );
        return registrationCodeRepository.save(registrationCode);
    }

    @Transactional
    public RegistrationCode consumeCode(String rawCode, String username) {
        RegistrationCode registrationCode = registrationCodeRepository.findByCodeForUpdate(normalizeCode(rawCode))
            .orElseThrow(() -> new IllegalArgumentException("注册码不存在"));

        if (registrationCode.isUsed()) {
            throw new IllegalArgumentException("注册码已使用");
        }
        if (registrationCode.isDisabled()) {
            throw new IllegalArgumentException("注册码已被禁用");
        }
        if (registrationCode.isExpired()) {
            throw new IllegalArgumentException("注册码已过期");
        }

        registrationCode.markUsedBy(username);
        return registrationCodeRepository.save(registrationCode);
    }

    @Transactional
    public RegistrationCode disableCode(Long id) {
        RegistrationCode registrationCode = getRequired(id);
        registrationCode.disable();
        return registrationCodeRepository.save(registrationCode);
    }

    @Transactional
    public void deleteCode(Long id) {
        RegistrationCode registrationCode = getRequired(id);
        registrationCodeRepository.delete(registrationCode);
    }

    @Transactional(readOnly = true)
    public RegistrationCode getRequired(Long id) {
        return registrationCodeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("注册码不存在"));
    }

    private String normalizeCode(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new IllegalArgumentException("注册码不能为空");
        }
        return rawCode.trim().toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String generated = generateCodeValue();
            if (!registrationCodeRepository.existsByCode(generated)) {
                return generated;
            }
        }
        throw new IllegalStateException("生成注册码失败，请稍后重试");
    }

    private String generateCodeValue() {
        StringBuilder builder = new StringBuilder(14);
        for (int groupIndex = 0; groupIndex < 3; groupIndex++) {
            if (groupIndex > 0) {
                builder.append('-');
            }
            for (int charIndex = 0; charIndex < 4; charIndex++) {
                builder.append(CODE_ALPHABET[SECURE_RANDOM.nextInt(CODE_ALPHABET.length)]);
            }
        }
        return builder.toString();
    }
}
