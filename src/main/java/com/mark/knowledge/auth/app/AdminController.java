package com.mark.knowledge.auth.app;

import com.mark.knowledge.auth.dto.*;
import com.mark.knowledge.auth.entity.Role;
import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.service.RbacService;
import com.mark.knowledge.auth.service.UserAccountService;
import com.mark.knowledge.rag.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 管理员后台接口：用户管理、角色管理、权限管理。
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final UserAccountService userAccountService;
    private final RbacService rbacService;

    public AdminController(UserAccountService userAccountService, RbacService rbacService) {
        this.userAccountService = userAccountService;
        this.rbacService = rbacService;
    }

    // --- User Management ---

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('user:read')")
    public ResponseEntity<List<UserResponse>> listUsers() {
        List<UserResponse> users = userAccountService.findAllUsers().stream()
            .map(UserResponse::from)
            .toList();
        return ResponseEntity.ok(users);
    }

    @PostMapping("/users")
    @PreAuthorize("hasAuthority('user:write')")
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest request) {
        try {
            Role role = rbacService.getRole(request.roleId());
            UserAccount user = userAccountService.createUser(request.username(), request.password(), role);
            return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("创建失败", e.getMessage()));
        }
    }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasAuthority('user:write')")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request) {
        try {
            Role role = request.roleId() != null ? rbacService.getRole(request.roleId()) : null;
            UserAccount user = userAccountService.updateUser(id, role, request.enabled());
            return ResponseEntity.ok(UserResponse.from(user));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("更新失败", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasAuthority('user:write')")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            userAccountService.deleteUser(id);
            return ResponseEntity.ok(new MessageResponse("用户已删除"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("删除失败", e.getMessage()));
        }
    }

    // --- Role Management ---

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<List<RoleResponse>> listRoles() {
        List<RoleResponse> roles = rbacService.listRoles().stream()
            .map(RoleResponse::from)
            .toList();
        return ResponseEntity.ok(roles);
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('role:write')")
    public ResponseEntity<?> createRole(@RequestBody CreateRoleRequest request) {
        try {
            Role role = rbacService.createRole(request.code(), request.name(), request.description(), request.permissionIds());
            return ResponseEntity.status(HttpStatus.CREATED).body(RoleResponse.from(role));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("创建失败", e.getMessage()));
        }
    }

    @PutMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('role:write')")
    public ResponseEntity<?> updateRole(@PathVariable Long id, @RequestBody UpdateRoleRequest request) {
        try {
            Role role = rbacService.updateRole(id, request.name(), request.description(), request.permissionIds());
            return ResponseEntity.ok(RoleResponse.from(role));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("更新失败", e.getMessage()));
        }
    }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('role:write')")
    public ResponseEntity<?> deleteRole(@PathVariable Long id) {
        try {
            rbacService.deleteRole(id);
            return ResponseEntity.ok(new MessageResponse("角色已删除"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("删除失败", e.getMessage()));
        }
    }

    // --- Permission Management ---

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('permission:read')")
    public ResponseEntity<List<PermissionResponse>> listPermissions() {
        List<PermissionResponse> permissions = rbacService.listPermissions().stream()
            .map(PermissionResponse::from)
            .toList();
        return ResponseEntity.ok(permissions);
    }

    // --- Admin reset password ---

    @PostMapping("/users/{id}/reset-password")
    @PreAuthorize("hasAuthority('user:write')")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody ResetPasswordRequest request) {
        try {
            userAccountService.resetPassword(id, request.newPassword());
            return ResponseEntity.ok(new MessageResponse("密码已重置"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("重置失败", e.getMessage()));
        }
    }

    public record CreateUserRequest(String username, String password, Long roleId) {}
    public record UpdateUserRequest(Long roleId, Boolean enabled) {}
    public record CreateRoleRequest(String code, String name, String description, List<Long> permissionIds) {}
    public record UpdateRoleRequest(String name, String description, List<Long> permissionIds) {}
    public record ResetPasswordRequest(String newPassword) {}
}
