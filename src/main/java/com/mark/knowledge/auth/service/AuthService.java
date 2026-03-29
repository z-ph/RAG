package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.dto.AuthStatusResponse;
import com.mark.knowledge.auth.dto.AuthUserResponse;
import com.mark.knowledge.auth.dto.LoginRequest;
import com.mark.knowledge.auth.dto.RegisterRequest;
import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.entity.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 认证服务。
 */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserAccountService userAccountService;
    private final RegistrationCodeService registrationCodeService;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserAccountService userAccountService,
            RegistrationCodeService registrationCodeService) {
        this.authenticationManager = authenticationManager;
        this.userAccountService = userAccountService;
        this.registrationCodeService = registrationCodeService;
    }

    public UserAccount login(LoginRequest request, HttpServletRequest httpServletRequest) {
        String normalizedUsername = userAccountService.normalizeUsername(request.username());
        userAccountService.validatePassword(request.password());

        Authentication authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(normalizedUsername, request.password())
        );
        storeAuthentication(authentication, httpServletRequest);

        return userAccountService.getRequiredByUsername(normalizedUsername);
    }

    @Transactional
    public UserAccount register(RegisterRequest request, HttpServletRequest httpServletRequest) {
        String normalizedUsername = userAccountService.normalizeUsername(request.username());
        userAccountService.validatePassword(request.password());
        userAccountService.ensureUsernameAvailable(normalizedUsername);
        registrationCodeService.consumeCode(request.registrationCode(), normalizedUsername);

        UserAccount userAccount = userAccountService.createUser(normalizedUsername, request.password(), UserRole.USER);

        Authentication authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(normalizedUsername, request.password())
        );
        storeAuthentication(authentication, httpServletRequest);
        return userAccount;
    }

    public void logout(HttpServletRequest httpServletRequest) {
        HttpSession session = httpServletRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
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

    private void storeAuthentication(Authentication authentication, HttpServletRequest httpServletRequest) {
        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(authentication);
        SecurityContextHolder.setContext(securityContext);

        HttpSession session = httpServletRequest.getSession(true);
        httpServletRequest.changeSessionId();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, securityContext);
    }
}
