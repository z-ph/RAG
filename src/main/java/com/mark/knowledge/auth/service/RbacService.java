package com.mark.knowledge.auth.service;

import com.mark.knowledge.auth.entity.Permission;
import com.mark.knowledge.auth.entity.Role;
import com.mark.knowledge.auth.repository.PermissionRepository;
import com.mark.knowledge.auth.repository.RoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * RBAC 角色与权限服务。
 */
@Service
public class RbacService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    public RbacService(RoleRepository roleRepository, PermissionRepository permissionRepository) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
    }

    // --- Permissions ---

    @Transactional(readOnly = true)
    public List<Permission> listPermissions() {
        return permissionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Permission getPermission(Long id) {
        return permissionRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("权限不存在"));
    }

    // --- Roles ---

    @Transactional(readOnly = true)
    public List<Role> listRoles() {
        return roleRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Role getRole(Long id) {
        return roleRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("角色不存在"));
    }

    @Transactional
    public Role createRole(String code, String name, String description, List<Long> permissionIds) {
        if (roleRepository.existsByCode(code)) {
            throw new IllegalArgumentException("角色编码已存在");
        }

        Role role = new Role(code, name, description);
        if (permissionIds != null && !permissionIds.isEmpty()) {
            Set<Permission> permissions = permissionIds.stream()
                .map(id -> permissionRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("权限不存在: " + id)))
                .collect(Collectors.toSet());
            role.setPermissions(permissions);
        }

        return roleRepository.save(role);
    }

    @Transactional
    public Role updateRole(Long id, String name, String description, List<Long> permissionIds) {
        Role role = roleRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("角色不存在"));

        if (name != null && !name.isBlank()) {
            role.setName(name);
        }

        if (description != null) {
            role.setDescription(description);
        }

        if (permissionIds != null) {
            Set<Permission> permissions = permissionIds.stream()
                .map(pid -> permissionRepository.findById(pid)
                    .orElseThrow(() -> new IllegalArgumentException("权限不存在: " + pid)))
                .collect(Collectors.toSet());
            role.setPermissions(permissions);
        }

        return roleRepository.save(role);
    }

    @Transactional
    public void deleteRole(Long id) {
        Role role = getRole(id);
        // Prevent deletion of built-in roles
        if (Set.of("SUPER_ADMIN", "ADMIN", "USER").contains(role.getCode())) {
            throw new IllegalArgumentException("不能删除系统内置角色");
        }
        roleRepository.delete(role);
    }
}
