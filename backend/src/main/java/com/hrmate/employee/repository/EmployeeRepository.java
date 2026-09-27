package com.hrmate.employee.repository;

import com.hrmate.employee.domain.Employee;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사원 조회·저장
 *
 * 논리 삭제된 사원을 걸러내는 조건(deletedAt IS NULL)은 엔티티 전체에 자동 적용하지 않고
 * 메서드 이름에 명시한다. 사번 중복 확인은 삭제된 사원까지 포함해야 하기 때문이다.
 */
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    /** 목록: 삭제되지 않은 사원, 사번 순 */
    List<Employee> findAllByDeletedAtIsNullOrderByEmployeeNoAsc();

    /** 상세·수정·삭제 대상 조회: 삭제된 사원은 제외 */
    Optional<Employee> findByIdAndDeletedAtIsNull(Long id);

    /**
     * 사번 사용 여부: 삭제된 사원 포함.
     * 사번 컬럼 정렬 규칙이 대소문자를 구분하지 않아 E001과 e001을 같은 사번으로 판단한다.
     * 호출 전에 Employee.normalizeEmployeeNo 로 대문자 변환하는 것을 원칙으로 한다.
     */
    boolean existsByEmployeeNo(String employeeNo);
}
