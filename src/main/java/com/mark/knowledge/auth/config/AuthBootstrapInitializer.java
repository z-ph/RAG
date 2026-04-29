package com.mark.knowledge.auth.config;

import com.mark.knowledge.auth.entity.Role;
import com.mark.knowledge.auth.repository.RoleRepository;
import com.mark.knowledge.auth.service.UserAccountService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 启动时确保存在一个管理员账号。
 */
@Component
@Order(2)
public class AuthBootstrapInitializer implements ApplicationRunner {

    @Value("${auth.bootstrap-admin.username:admin}")
    private String bootstrapAdminUsername;

    @Value("${auth.bootstrap-admin.password:ChangeMe123!}")
    private String bootstrapAdminPassword;

    private final UserAccountService userAccountService;
    private final RoleRepository roleRepository;

    public AuthBootstrapInitializer(UserAccountService userAccountService, RoleRepository roleRepository) {
        this.userAccountService = userAccountService;
        this.roleRepository = roleRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        Optional<Role> superAdminRole = roleRepository.findByCode("SUPER_ADMIN");
        if (superAdminRole.isEmpty()) {
            return;
        }

        userAccountService.ensureBootstrapAdmin(bootstrapAdminUsername, bootstrapAdminPassword, superAdminRole.get());
    }
}
