package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.entity.Role;
import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
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

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();

        if (userAccount.getAssignedRole() != null) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + userAccount.getAssignedRole().getCode()));
            userAccount.getAssignedRole().getPermissions().forEach(p ->
                authorities.add(new SimpleGrantedAuthority(p.getCode()))
            );
        } else {
            String legacyRole = userAccount.getRole();
            if (legacyRole != null) {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + legacyRole));
            }
        }

        return User.withUsername(userAccount.getUsername())
            .password(userAccount.getPasswordHash())
            .authorities(authorities)
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
        return userAccountRepository.countByRole("ADMIN") > 0;
    }

    @Transactional(readOnly = true)
    public List<UserAccount> findAllUsers() {
        return userAccountRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findById(Long id) {
        return userAccountRepository.findById(id);
    }

    @Transactional
    public UserAccount createUser(String username, String rawPassword, Role role) {
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
    public UserAccount updateUser(Long id, Role role, Boolean enabled) {
        UserAccount user = userAccountRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (role != null) {
            user.setAssignedRole(role);
        }

        if (enabled != null) {
            user.setEnabled(enabled);
        }

        return userAccountRepository.save(user);
    }

    @Transactional
    public void deleteUser(Long id) {
        UserAccount user = userAccountRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        userAccountRepository.delete(user);
    }

    @Transactional
    public void ensureBootstrapAdmin(String username, String rawPassword, Role adminRole) {
        if (hasAdminAccount()) {
            return;
        }

        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalStateException("未找到管理员账号，且未配置有效的初始管理员用户名/密码");
        }

        UserAccount adminAccount = createUser(username, rawPassword, adminRole);
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

    @Transactional
    public void changePassword(String username, String currentPassword, String newPassword) {
        UserAccount user = getRequiredByUsername(username);

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("当前密码不正确");
        }

        validatePassword(newPassword);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userAccountRepository.save(user);
    }

    @Transactional
    public void resetPassword(Long userId, String newPassword) {
        UserAccount user = userAccountRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        validatePassword(newPassword);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userAccountRepository.save(user);
    }
}
