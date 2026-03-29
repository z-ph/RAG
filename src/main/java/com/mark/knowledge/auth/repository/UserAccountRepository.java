package com.mark.knowledge.auth.repository;

import com.mark.knowledge.auth.entity.UserAccount;
import com.mark.knowledge.auth.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByUsername(String username);

    boolean existsByUsername(String username);

    long countByRole(UserRole role);
}
