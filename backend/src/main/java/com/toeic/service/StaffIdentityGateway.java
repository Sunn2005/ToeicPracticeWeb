package com.toeic.service;

import com.google.firebase.auth.*;
import com.toeic.controller.ApiCodeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.Map;

/** Passwords and provider responses must never be logged or returned to API callers. */
public interface StaffIdentityGateway {
    boolean emailExists(String email) throws Exception;
    String createDisabled(String email, String name, String password) throws Exception;
    void enable(String uid) throws Exception;
    void delete(String uid) throws Exception;
    void setPasswordAndRevoke(String uid, String password) throws Exception;
    void verifyPassword(String uid, String email, String password);

    @Component
    class Firebase implements StaffIdentityGateway {
        private final FirebaseAuth auth;
        private final String apiKey;
        private final RestClient client = RestClient.builder().requestFactory(
                new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder()
                        .connectTimeout(java.time.Duration.ofSeconds(10)).build()) {{ setReadTimeout(java.time.Duration.ofSeconds(15)); }}).build();
        public Firebase(FirebaseAuth auth, @Value("${staff.auth.web-api-key:}") String apiKey) { this.auth = auth; this.apiKey = apiKey; }
        public boolean emailExists(String email) throws Exception {
            try { auth.getUserByEmail(email); return true; }
            catch (FirebaseAuthException failure) { if (failure.getAuthErrorCode() == AuthErrorCode.USER_NOT_FOUND) return false; throw unavailable(); }
        }
        public String createDisabled(String email, String name, String password) throws Exception {
            try { return auth.createUser(new UserRecord.CreateRequest().setEmail(email).setDisplayName(name).setPassword(password).setDisabled(true)).getUid(); }
            catch (FirebaseAuthException failure) {
                if (failure.getAuthErrorCode() == AuthErrorCode.EMAIL_ALREADY_EXISTS) throw new ApiCodeException(HttpStatus.CONFLICT, "STAFF_EMAIL_EXISTS", "Email đã có tài khoản");
                throw unavailable();
            }
        }
        private ApiCodeException unavailable() { return new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE, "STAFF_AUTH_UNAVAILABLE", "Dịch vụ tài khoản chưa sẵn sàng"); }
        public void enable(String uid) throws Exception { auth.updateUser(new UserRecord.UpdateRequest(uid).setDisabled(false)); }
        public void delete(String uid) throws Exception { auth.deleteUser(uid); }
        public void setPasswordAndRevoke(String uid, String password) throws Exception {
            auth.updateUser(new UserRecord.UpdateRequest(uid).setPassword(password));
            auth.revokeRefreshTokens(uid);
        }
        public void verifyPassword(String uid, String email, String password) {
            if (apiKey.isBlank()) throw new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE, "STAFF_AUTH_UNAVAILABLE", "Chưa cấu hình xác thực mật khẩu");
            try {
                Map<?, ?> result = client.post().uri("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={key}", apiKey)
                        .body(Map.of("email", email, "password", password, "returnSecureToken", true)).retrieve().body(Map.class);
                if (result == null || !uid.equals(result.get("localId"))) throw new IllegalArgumentException();
            } catch (org.springframework.web.client.HttpClientErrorException failure) {
                throw new ApiCodeException(HttpStatus.BAD_REQUEST, "STAFF_PASSWORD_INCORRECT", "Mật khẩu hiện tại không chính xác hoặc yêu cầu bị giới hạn");
            } catch (Exception failure) {
                throw new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE, "STAFF_AUTH_UNAVAILABLE", "Không thể xác thực mật khẩu lúc này");
            }
        }
    }
}
