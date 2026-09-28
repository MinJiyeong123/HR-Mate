package com.hrmate.yearend.repository;

import com.hrmate.yearend.domain.YearEndInput;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 연말정산 입력 자료 조회·저장 */
public interface YearEndInputRepository extends JpaRepository<YearEndInput, Long> {

    /** 사원·귀속연도별 입력 자료 (사원·연도당 1건) */
    Optional<YearEndInput> findByEmployee_IdAndTaxYear(Long employeeId, int taxYear);

    /** 귀속연도의 입력 자료 전체 (목록 화면용) */
    List<YearEndInput> findAllByTaxYear(int taxYear);
}
