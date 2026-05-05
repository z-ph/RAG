package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.dto.AuthStatusResponse;
import com.mark.knowledge.auth.dto.AuthUserResponse;
import com.mark.knowledge.auth.dto.LoginRequest;
import com.mark.knowledge.auth.dto.RegisterRequest;
import com.mark.knowledge.auth.dto.TokenResponse;
import com.mark.knowledge.auth.entity.Role;
import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.repository.RoleRepository;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserAccountService userAccountService;
    private final RegistrationCodeService registrationCodeService;
    private final RoleRepository roleRepository;
    private final JwtUtil jwtUtil;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserAccountService userAccountService,
            RegistrationCodeService registrationCodeService,
            RoleRepository roleRepository,
            JwtUtil jwtUtil) {
        this.authenticationManager = authenticationManager;
        this.userAccountService = userAccountService;
        this.registrationCodeService = registrationCodeService;
        this.roleRepository = roleRepository;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        String normalizedUsername = userAccountService.normalizeUsername(request.username());
        userAccountService.validatePassword(request.password());

        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(normalizedUsername, request.password())
        );

        UserAccount userAccount = userAccountService.getRequiredByUsername(normalizedUsername);
        return generateAndStoreTokens(userAccount);
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        String normalizedUsername = userAccountService.normalizeUsername(request.username());
        userAccountService.validatePassword(request.password());
        userAccountService.ensureUsernameAvailable(normalizedUsername);
        registrationCodeService.consumeCode(request.registrationCode(), normalizedUsername);

        Role defaultUserRole = roleRepository.findByCode("USER")
            .orElseThrow(() -> new IllegalStateException("系统未配置默认用户角色"));

        userAccountService.createUser(normalizedUsername, request.password(), defaultUserRole);
        UserAccount userAccount = userAccountService.getRequiredByUsername(normalizedUsername);
        return generateAndStoreTokens(userAccount);
    }

    public void logout() {
        // Stateless JWT — server-side no-op. Frontend clears localStorage.
    }

    public AuthStatusResponse getCurrentUser(Authentication authentication) {
        if (authentication == null
                || authentication instanceof AnonymousAuthenticationToken
                || !authentication.isAuthenticated()) {
            return new AuthStatusResponse(false, null);
        }

        UserAccount userAccount = userAccountService.getRequiredByUsername(authentication.getName());
        return new AuthStatusResponse(true, AuthUserResponse.from(userAccount));
    }

    @Transactional
    public TokenResponse refresh(String refreshToken) {
        Claims claims = jwtUtil.parseToken(refreshToken);

        if (!jwtUtil.isRefreshToken(claims)) {
            throw new IllegalArgumentException("无效的 Refresh Token");
        }

        String username = claims.getSubject();
        String jti = jwtUtil.getJti(claims);

        UserAccount userAccount = userAccountService.getRequiredByUsername(username);

        if (!jti.equals(userAccount.getRefreshTokenJti())) {
            throw new IllegalArgumentException("Refresh Token 已失效");
        }

        return generateAndStoreTokens(userAccount);
    }

    private TokenResponse generateAndStoreTokens(UserAccount userAccount) {
        List<String> authorities = buildAuthorityStrings(userAccount);

        String accessToken = jwtUtil.generateAccessToken(
            userAccount.getUsername(),
            userAccount.getId(),
            userAccount.getRole(),
            authorities
        );
        String refreshToken = jwtUtil.generateRefreshToken(userAccount.getUsername());

        // Store jti for Refresh Token Rotation
        Claims refreshClaims = jwtUtil.parseToken(refreshToken);
        userAccount.setRefreshTokenJti(jwtUtil.getJti(refreshClaims));
        userAccountService.save(userAccount);

        return new TokenResponse(accessToken, refreshToken);
    }

    private List<String> buildAuthorityStrings(UserAccount userAccount) {
        List<String> authorities = new ArrayList<>();
        if (userAccount.getAssignedRole() != null) {
            authorities.add("ROLE_" + userAccount.getAssignedRole().getCode());
            userAccount.getAssignedRole().getPermissions().forEach(p ->
                authorities.add(p.getCode())
            );
        } else if (userAccount.getRole() != null) {
            authorities.add("ROLE_" + userAccount.getRole());
        }
        return authorities;
    }
}
