package com.hrmate.payroll.repository;

import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /** 귀속 연도·기간 상태별 급여 (연간 집계용). 기간·사원·항목을 함께 읽고 사번·월 순 */
    @Query("""
            select distinct p from Payroll p
            join fetch p.period pp
            join fetch p.employee
            left join fetch p.lines l
            left join fetch l.payItem
            where pp.payYear = :year and pp.status = :status
            order by p.employeeNo asc, pp.payMonth asc
            """)
    List<Payroll> findAllForAnnual(@Param("year") int year, @Param("status") PayrollPeriodStatus status);

    /** 한 사원의 귀속 연도·기간 상태별 급여 (연간 집계용). 월 순 */
    @Query("""
            select distinct p from Payroll p
            join fetch p.period pp
            join fetch p.employee e
            left join fetch p.lines l
            left join fetch l.payItem
            where e.id = :employeeId and pp.payYear = :year and pp.status = :status
            order by pp.payMonth asc
            """)
    List<Payroll> findAllForAnnualByEmployee(@Param("employeeId") Long employeeId, @Param("year") int year,
                                             @Param("status") PayrollPeriodStatus status);

    /** 한 사원의 귀속 연도·기간 상태별 급여 건수 (연간 집계에서 제외된 작성 중 급여 수) */
    long countByEmployee_IdAndPeriod_PayYearAndPeriod_Status(Long employeeId, int payYear, PayrollPeriodStatus status);

    /** 기간별 인원·합계 (목록 화면용, 한 번의 집계 조회) */
    @Query("""
            select p.period.id as periodId, count(p) as payrollCount,
                   sum(p.totalEarnings) as totalEarnings, sum(p.totalDeductions) as totalDeductions,
                   sum(p.netPay) as totalNetPay
            from Payroll p
            group by p.period.id
            """)
    List<PeriodTotals> summarizeByPeriod();

    /** 기간별 집계 결과 */
    interface PeriodTotals {
        Long getPeriodId();

        long getPayrollCount();

        long getTotalEarnings();

        long getTotalDeductions();

        long getTotalNetPay();
    }
}
