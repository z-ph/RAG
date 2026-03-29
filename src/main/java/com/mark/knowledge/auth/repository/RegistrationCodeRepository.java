package com.mark.knowledge.auth.repository;

import com.mark.knowledge.auth.entity.RegistrationCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RegistrationCodeRepository extends JpaRepository<RegistrationCode, Long> {

    boolean existsByCode(String code);

    List<RegistrationCode> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select code from RegistrationCode code where code.code = :code")
    Optional<RegistrationCode> findByCodeForUpdate(@Param("code") String code);
}
