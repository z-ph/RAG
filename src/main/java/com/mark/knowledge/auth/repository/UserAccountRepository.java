package com.mark.knowledge.auth.repository;

import com.mark.knowledge.auth.entity.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByUsername(String username);

    boolean existsByUsername(String username);

    long countByRole(String role);

    List<UserAccount> findAllByOrderByCreatedAtDesc();
}
