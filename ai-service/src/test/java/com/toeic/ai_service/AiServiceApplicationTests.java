package com.toeic.ai_service;

import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@ActiveProfiles("test")
class AiServiceApplicationTests {

	@MockitoBean
	Firestore firestore;

	@MockitoBean
	FirebaseApp firebaseApp;

	@Test
	void contextLoads() {
	}

}
