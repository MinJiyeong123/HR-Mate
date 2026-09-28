package com.hrmate;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** 서버 전체 설정이 뜨는지 확인한다. 테스트 DB(hr_mate_test, test 프로필)에 연결한다. */
@SpringBootTest
@ActiveProfiles("test")
class HrMateApplicationTests {

	@Test
	void contextLoads() {
	}

}
