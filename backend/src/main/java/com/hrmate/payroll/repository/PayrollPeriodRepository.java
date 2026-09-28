package com.hrmate.payroll.repository;

import com.hrmate.payroll.domain.PayrollPeriod;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 급여 기간 조회·저장 */
public interface PayrollPeriodRepository extends JpaRepository<PayrollPeriod, Long> {

    /** 같은 귀속 연월의 기간이 있는지 (연월당 1개) */
    boolean existsByPayYearAndPayMonth(int payYear, int payMonth);

    /** 목록: 최신 연월부터 */
    List<PayrollPeriod> findAllByOrderByPayYearDescPayMonthDesc();
}
