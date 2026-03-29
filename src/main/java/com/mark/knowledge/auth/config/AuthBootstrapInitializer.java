package com.mark.knowledge.auth.config;

import com.mark.knowledge.auth.service.UserAccountService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 启动时确保存在一个管理员账号。
 */
@Component
public class AuthBootstrapInitializer implements ApplicationRunner {

    @Value("${auth.bootstrap-admin.username:admin}")
    private String bootstrapAdminUsername;

    @Value("${auth.bootstrap-admin.password:ChangeMe123!}")
    private String bootstrapAdminPassword;

    private final UserAccountService userAccountService;

    public AuthBootstrapInitializer(UserAccountService userAccountService) {
        this.userAccountService = userAccountService;
    }

    @Override
    public void run(ApplicationArguments args) {
        userAccountService.ensureBootstrapAdmin(bootstrapAdminUsername, bootstrapAdminPassword);
    }
}
