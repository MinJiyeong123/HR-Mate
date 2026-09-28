package com.hrmate.payroll.repository;

import com.hrmate.payroll.domain.Payroll;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사원별 월 급여 조회·저장 (급여 항목은 Payroll 을 통해 함께 저장·삭제된다) */
public interface PayrollRepository extends JpaRepository<Payroll, Long> {

    /** 기간별 급여 목록, 사번 순 */
    List<Payroll> findAllByPeriod_IdOrderByEmployeeNoAsc(Long periodId);

    /** 같은 기간에 같은 사원 급여가 있는지 (기간당 사원 1건) */
    boolean existsByPeriod_IdAndEmployee_Id(Long periodId, Long employeeId);

    /** 기간별 급여 건수 (확정 조건 확인용) */
    long countByPeriod_Id(Long periodId);

    /** 사원·연도별 급여 내역, 월 순 */
    List<Payroll> findAllByEmployee_IdAndPeriod_PayYearOrderByPeriod_PayMonthAsc(Long employeeId, int payYear);
}
