package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.entity.UserRole;
import com.mark.knowledge.auth.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 用户账号服务。
 */
@Service
public class UserAccountService implements UserDetailsService {

    private static final Logger log = LoggerFactory.getLogger(UserAccountService.class);
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9._-]{3,32}$");

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public UserAccountService(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserAccount userAccount = findByUsername(normalizeUsername(username))
            .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + username));

        return User.withUsername(userAccount.getUsername())
            .password(userAccount.getPasswordHash())
            .roles(userAccount.getRole().name())
            .disabled(!userAccount.isEnabled())
            .build();
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findByUsername(String username) {
        return userAccountRepository.findByUsername(username);
    }

    @Transactional(readOnly = true)
    public UserAccount getRequiredByUsername(String username) {
        return findByUsername(normalizeUsername(username))
            .orElseThrow(() -> new IllegalArgumentException("用户不存在: " + username));
    }

    @Transactional(readOnly = true)
    public boolean hasAdminAccount() {
        return userAccountRepository.countByRole(UserRole.ADMIN) > 0;
    }

    @Transactional
    public UserAccount createUser(String username, String rawPassword, UserRole role) {
        String normalizedUsername = normalizeUsername(username);
        validatePassword(rawPassword);

        if (userAccountRepository.existsByUsername(normalizedUsername)) {
            throw new IllegalArgumentException("用户名已存在");
        }

        UserAccount userAccount = new UserAccount(
            normalizedUsername,
            passwordEncoder.encode(rawPassword),
            role
        );
        return userAccountRepository.save(userAccount);
    }

    @Transactional
    public void ensureBootstrapAdmin(String username, String rawPassword) {
        if (hasAdminAccount()) {
            return;
        }

        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalStateException("未找到管理员账号，且未配置有效的初始管理员用户名/密码");
        }

        UserAccount adminAccount = createUser(username, rawPassword, UserRole.ADMIN);
        log.info("已初始化默认管理员账号: {}", adminAccount.getUsername());
    }

    public void ensureUsernameAvailable(String username) {
        if (userAccountRepository.existsByUsername(normalizeUsername(username))) {
            throw new IllegalArgumentException("用户名已存在");
        }
    }

    public String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("用户名不能为空");
        }

        String normalized = username.trim().toLowerCase(Locale.ROOT);
        if (!USERNAME_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("用户名仅支持 3-32 位小写字母、数字、点、下划线和连字符");
        }
        return normalized;
    }

    public void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("密码不能为空");
        }
        if (rawPassword.length() < 8 || rawPassword.length() > 72) {
            throw new IllegalArgumentException("密码长度需为 8-72 位");
        }
    }
}
