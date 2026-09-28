package com.hrmate.payroll.repository;

import com.hrmate.payroll.domain.PayItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 지급·공제 항목 조회 */
public interface PayItemRepository extends JpaRepository<PayItem, Long> {

    /** 사용 중인 항목, 표시 순서대로 */
    List<PayItem> findAllByActiveTrueOrderBySortOrderAsc();
}
