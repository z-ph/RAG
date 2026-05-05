package com.mark.knowledge.auth.app;

import com.mark.knowledge.auth.dto.AuthStatusResponse;
import com.mark.knowledge.auth.dto.AuthSuccessResponse;
import com.mark.knowledge.auth.dto.AuthUserResponse;
import com.mark.knowledge.auth.dto.ChangePasswordRequest;
import com.mark.knowledge.auth.dto.LoginRequest;
import com.mark.knowledge.auth.dto.MessageResponse;
import com.mark.knowledge.auth.dto.RegisterRequest;
import com.mark.knowledge.auth.dto.RegistrationCodeCreateRequest;
import com.mark.knowledge.auth.dto.RegistrationCodeListResponse;
import com.mark.knowledge.auth.dto.RegistrationCodeResponse;
import com.mark.knowledge.auth.dto.TokenResponse;
import com.mark.knowledge.auth.entity.RegistrationCode;
import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.service.AuthService;
import com.mark.knowledge.auth.service.RegistrationCodeService;
import com.mark.knowledge.auth.service.UserAccountService;
import com.mark.knowledge.rag.dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final RegistrationCodeService registrationCodeService;
    private final UserAccountService userAccountService;

    public AuthController(AuthService authService, RegistrationCodeService registrationCodeService, UserAccountService userAccountService) {
        this.authService = authService;
        this.registrationCodeService = registrationCodeService;
        this.userAccountService = userAccountService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            TokenResponse tokens = authService.login(request);
            UserAccount userAccount = userAccountService.getRequiredByUsername(
                userAccountService.normalizeUsername(request.username()));
            return ResponseEntity.ok(new AuthSuccessResponse(
                "登录成功", AuthUserResponse.from(userAccount), tokens.accessToken(), tokens.refreshToken()));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse("登录失败", "用户名或密码错误"));
        } catch (org.springframework.security.authentication.AuthenticationServiceException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse("登录失败", "用户名或密码错误"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("无效请求", e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        try {
            TokenResponse tokens = authService.register(request);
            UserAccount userAccount = userAccountService.getRequiredByUsername(
                userAccountService.normalizeUsername(request.username()));
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthSuccessResponse(
                    "注册成功", AuthUserResponse.from(userAccount), tokens.accessToken(), tokens.refreshToken()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("注册失败", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout() {
        authService.logout();
        return ResponseEntity.ok(new MessageResponse("已退出登录"));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthStatusResponse> me(Authentication authentication) {
        return ResponseEntity.ok(authService.getCurrentUser(authentication));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request, Authentication authentication) {
        try {
            userAccountService.changePassword(authentication.getName(), request.currentPassword(), request.newPassword());
            return ResponseEntity.ok(new MessageResponse("密码已修改"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("修改失败", e.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        try {
            String refreshToken = body.get("refreshToken");
            if (refreshToken == null || refreshToken.isBlank()) {
                return ResponseEntity.badRequest().body(new ErrorResponse("无效请求", "缺少 refreshToken"));
            }
            TokenResponse tokens = authService.refresh(refreshToken);
            return ResponseEntity.ok(tokens);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse("刷新失败", e.getMessage()));
        }
    }

    @GetMapping("/registration-codes")
    public ResponseEntity<RegistrationCodeListResponse> listRegistrationCodes() {
        List<RegistrationCodeResponse> codes = registrationCodeService.listCodes().stream()
            .map(RegistrationCodeResponse::from)
            .toList();
        return ResponseEntity.ok(new RegistrationCodeListResponse(codes, codes.size()));
    }

    @PostMapping("/registration-codes")
    public ResponseEntity<?> createRegistrationCode(
            @RequestBody(required = false) RegistrationCodeCreateRequest request,
            Authentication authentication) {
        try {
            RegistrationCodeCreateRequest safeRequest = request == null
                ? new RegistrationCodeCreateRequest(null, null)
                : request;
            RegistrationCode registrationCode = registrationCodeService.createCode(
                authentication.getName(),
                safeRequest.note(),
                safeRequest.expiresAt()
            );
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(RegistrationCodeResponse.from(registrationCode));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("创建失败", e.getMessage()));
        }
    }

    @PatchMapping("/registration-codes/{id}/disable")
    public ResponseEntity<?> disableRegistrationCode(@PathVariable Long id) {
        try {
            RegistrationCode registrationCode = registrationCodeService.disableCode(id);
            return ResponseEntity.ok(RegistrationCodeResponse.from(registrationCode));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse("未找到注册码", e.getMessage()));
        }
    }

    @DeleteMapping("/registration-codes/{id}")
    public ResponseEntity<?> deleteRegistrationCode(@PathVariable Long id) {
        try {
            registrationCodeService.deleteCode(id);
            return ResponseEntity.ok(new MessageResponse("注册码已删除"));
        } catch (IllegalArgumentException e) {
            log.warn("删除注册码失败: id={}", id, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse("未找到注册码", e.getMessage()));
        }
    }
}
