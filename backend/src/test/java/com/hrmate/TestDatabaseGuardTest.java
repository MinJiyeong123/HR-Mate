package com.hrmate;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

/**
 * 안전 확인: 테스트가 개발 DB(hr_mate)가 아닌 테스트 DB(hr_mate_test)에
 * 테스트 계정(hrmate_test)으로 연결되는지 확인한다. 조회만 한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class TestDatabaseGuardTest {

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private Environment environment;

    @Test
    void 테스트는_test_프로필로만_실행된다() {
        assertThat(environment.getActiveProfiles()).containsExactly("test");
    }

    @Test
    void 테스트_DB와_테스트_계정으로_연결된다() {
        Object[] row = (Object[]) entityManager
                .createNativeQuery("SELECT DATABASE(), CURRENT_USER()")
                .getSingleResult();

        assertThat(row[0]).isEqualTo("hr_mate_test");
        assertThat(String.valueOf(row[1])).startsWith("hrmate_test@");
    }
}
