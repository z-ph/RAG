package com.mark.knowledge.auth.config;

import com.mark.knowledge.auth.entity.Permission;
import com.mark.knowledge.auth.entity.Role;
import com.mark.knowledge.auth.repository.PermissionRepository;
import com.mark.knowledge.auth.repository.RoleRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 启动时初始化 RBAC 权限和角色数据。
 */
@Component
@Order(1)
public class RbacBootstrapInitializer implements ApplicationRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;

    public RbacBootstrapInitializer(PermissionRepository permissionRepository, RoleRepository roleRepository) {
        this.permissionRepository = permissionRepository;
        this.roleRepository = roleRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (permissionRepository.count() > 0) {
            return; // Already initialized
        }

        // 1. Create permissions
        List<Permission> permissions = Arrays.asList(
            new Permission("user:read", "查看用户", "查看用户列表和详情", "用户管理"),
            new Permission("user:write", "管理用户", "创建、编辑、删除用户", "用户管理"),
            new Permission("role:read", "查看角色", "查看角色列表和详情", "角色管理"),
            new Permission("role:write", "管理角色", "创建、编辑、删除角色", "角色管理"),
            new Permission("permission:read", "查看权限", "查看系统权限列表", "权限管理"),
            new Permission("registration_code:manage", "管理注册码", "创建、禁用、删除注册码", "注册码管理"),
            new Permission("document:manage", "管理文档", "上传、删除、重新索引文档", "文档管理"),
            new Permission("prompt:manage", "管理提示词", "查看和修改系统提示词", "提示词管理"),
            new Permission("system:manage", "系统管理", "管理文档段落、系统配置等", "系统管理")
        );

        permissionRepository.saveAll(permissions);

        // 2. Create roles
        Role superAdmin = new Role("SUPER_ADMIN", "超级管理员", "拥有系统所有权限");
        Role admin = new Role("ADMIN", "管理员", "拥有大部分管理权限");
        Role user = new Role("USER", "普通用户", "只能使用基础功能");

        roleRepository.saveAll(Arrays.asList(superAdmin, admin, user));

        // 3. Assign permissions to roles
        superAdmin.setPermissions(new HashSet<>(permissions));
        roleRepository.save(superAdmin);

        Set<Permission> adminPermissions = new HashSet<>(Arrays.asList(
            findPermission(permissions, "user:read"),
            findPermission(permissions, "user:write"),
            findPermission(permissions, "role:read"),
            findPermission(permissions, "role:write"),
            findPermission(permissions, "permission:read"),
            findPermission(permissions, "registration_code:manage"),
            findPermission(permissions, "document:manage"),
            findPermission(permissions, "prompt:manage"),
            findPermission(permissions, "system:manage")
        ));
        admin.setPermissions(adminPermissions);
        roleRepository.save(admin);

        Set<Permission> userPermissions = new HashSet<>(Arrays.asList(
            findPermission(permissions, "document:manage")
        ));
        user.setPermissions(userPermissions);
        roleRepository.save(user);
    }

    private Permission findPermission(List<Permission> permissions, String code) {
        return permissions.stream()
            .filter(p -> p.getCode().equals(code))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Permission not found: " + code));
    }
}
