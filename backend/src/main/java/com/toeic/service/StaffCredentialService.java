package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.StaffStore;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.*;

@Service
public class StaffCredentialService {
    private static final long TEMP_TTL = Duration.ofHours(24).toMillis();
    private static final long RESET_TTL = Duration.ofHours(1).toMillis();
    private static final long COOLDOWN = Duration.ofSeconds(60).toMillis();
    private final StaffStore store;
    private final StaffIdentityGateway identity;
    private final StaffMailGateway mail;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    @org.springframework.beans.factory.annotation.Autowired
    public StaffCredentialService(StaffStore store, StaffIdentityGateway identity, StaffMailGateway mail) {
        this(store, identity, mail, Clock.systemUTC());
    }
    StaffCredentialService(StaffStore store, StaffIdentityGateway identity, StaffMailGateway mail, Clock clock) {
        this.store = store; this.identity = identity; this.mail = mail; this.clock = clock;
    }
    public record CreateRequest(String displayName, String phoneNumber, String email, String groupId, Boolean active, String notes) {
        @Override public String toString() { return "CreateStaffRequest[redacted]"; }
    }
    public record Result(String uid, String emailStatus, Long lastSentAt) {}
    public Result create(String actor, CreateRequest request) throws Exception {
        String name = text(request.displayName(), 80), email = email(request.email());
        String phone = text(request.phoneNumber(), 16), group = text(request.groupId(), 128);
        if (!phone.matches("\\+?[0-9]{8,15}") || request.active() == null || (request.notes() != null && request.notes().length() > 1000)) throw error("STAFF_INVALID");
        var initial = store.read(); requireAdmin(initial, actor);
        if (!initial.groups().containsKey(group)) throw error("STAFF_NOT_FOUND");
        if (hasEmail(initial, email) || identity.emailExists(email)) throw error("STAFF_EMAIL_EXISTS");
        String password = secret() + "aA9!";
        String uid = identity.createDisabled(email, name, password);
        // This UID was created by this operation only. Never delete an existing account.
        try {
            store.transact(data -> {
                requireAdmin(data, actor);
                if (!data.groups().containsKey(group)) throw error("STAFF_NOT_FOUND");
                if (hasEmail(data, email)) throw error("STAFF_EMAIL_EXISTS");
                User user = new User(); user.setUid(uid); user.setEmail(email); user.setDisplayName(name); user.setPhoneNumber(phone);
                user.setRole("admin".equals(group) ? UserRole.ADMIN : UserRole.EMPLOYEE);
                user.setStaffGroupId(group); user.setStaffActive(request.active()); user.setStaffNotes(request.notes()); user.setStaffVersion(1L);
                user.setCreatedAt(clock.millis()); user.setStaffProvisioned(true); user.setPasswordChangeRequired(true);
                user.setTemporaryPasswordExpiresAt(clock.millis() + TEMP_TTL); user.setCredentialEmailStatus("PENDING");
                user.setCredentialLastSentAt(clock.millis()); user.setCredentialOperation("PROVISION");
                data.users().put(uid, user); return null;
            });
        } catch (Exception failure) {
            // A commit acknowledgement may have been lost. Keep a committed account recoverable.
            if (!store.read().users().containsKey(uid)) identity.delete(uid);
            throw failure;
        }
        try { identity.enable(uid); }
        catch (Exception failure) { finishDelivery(uid, "FAILED"); return new Result(uid, "FAILED", clock.millis()); }
        return deliver(uid, email, password);
    }
    public Result resend(String actor, String uid) throws Exception {
        User user = store.transact(data -> {
            requireAdmin(data, actor); User target = requireStaff(data, uid);
            if (!Boolean.TRUE.equals(target.getStaffProvisioned())) throw error("STAFF_INVALID");
            requireIdle(target); requireCooldown(target.getCredentialLastSentAt());
            bumpVersion(target); target.setCredentialOperation("RESEND"); target.setCredentialLastSentAt(clock.millis());
            target.setCredentialsChangedAt(clock.millis());
            target.setCredentialEmailStatus("PENDING"); target.setPasswordChangeRequired(true);
            target.setTemporaryPasswordExpiresAt(0L); clearReset(target); return target;
        });
        String password = secret() + "aA9!";
        try {
            identity.setPasswordAndRevoke(uid, password); identity.enable(uid);
            store.transact(data -> {
                User target = data.users().get(uid);
                target.setCredentialsChangedAt(clock.millis());
                target.setTemporaryPasswordExpiresAt(clock.millis() + TEMP_TTL); return null;
            });
        } catch (Exception failure) { finishDelivery(uid, "FAILED"); return new Result(uid, "FAILED", user.getCredentialLastSentAt()); }
        return deliver(uid, user.getEmail(), password);
    }
    private Result deliver(String uid, String email, String password) throws Exception {
        String status = "SENT";
        try { mail.credentials(email, password); } catch (Exception failure) { status = "FAILED"; }
        finishDelivery(uid, status);
        return new Result(uid, status, clock.millis());
    }
    private void finishDelivery(String uid, String status) throws Exception {
        store.transact(data -> { User user = data.users().get(uid); user.setCredentialEmailStatus(status); user.setCredentialOperation(null); return null; });
    }
    /** Called on a bounded worker. Every public request returns the same response, including mail failures. */
    public void requestReset(String rawEmail) {
        try {
            String email = email(rawEmail), token = secret();
            String uid = store.transact(data -> {
                User user = data.users().values().stream().filter(u -> email.equalsIgnoreCase(u.getEmail())).findFirst().orElse(null);
                if (user == null || !canRecover(user) || Boolean.FALSE.equals(user.getStaffActive())) return null;
                requireIdle(user); requireCooldown(user.getStaffResetRequestedAt());
                user.setStaffResetRequestedAt(clock.millis()); user.setStaffResetTokenHash(hash(token));
                user.setStaffResetExpiresAt(clock.millis() + RESET_TTL); return user.getUid();
            });
            if (uid != null) mail.resetLink(email, token);
        } catch (Exception ignored) { /* No email, token, provider payload or password in logs. */ }
    }
    public void reset(String rawEmail, String token, String password) throws Exception {
        validatePassword(password);
        String email = email(rawEmail);
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw error("STAFF_RESET_INVALID");
        User user = store.transact(data -> {
            User target = data.users().values().stream().filter(u -> email.equalsIgnoreCase(u.getEmail())).findFirst().orElse(null);
            if (target == null || !canRecover(target) || Boolean.FALSE.equals(target.getStaffActive()) || target.getStaffResetExpiresAt() == null
                    || target.getStaffResetExpiresAt() <= clock.millis() || !hash(token).equals(target.getStaffResetTokenHash())) throw error("STAFF_RESET_INVALID");
            requireIdle(target); bumpVersion(target); target.setCredentialsChangedAt(clock.millis()); target.setCredentialOperation("RESET");
            target.setPasswordChangeRequired(true); target.setTemporaryPasswordExpiresAt(0L); clearReset(target); return target;
        });
        completePassword(user.getUid(), password);
    }
    public void change(String uid, String oldPassword, String password) throws Exception {
        validatePassword(password);
        if (oldPassword == null || oldPassword.isBlank() || oldPassword.length() > 128 || password.equals(oldPassword)) throw error("STAFF_PASSWORD_INVALID");
        // Verify before mutating lifecycle state: an incorrect current password cannot lock the account.
        User current = requirePasswordOwner(store.read(), uid);
        requireTemporaryValid(current);
        Long expectedVersion = current.getCredentialVersion();
        identity.verifyPassword(uid, current.getEmail(), oldPassword);
        store.transact(data -> {
            User user = requirePasswordOwner(data, uid); requireIdle(user); requireTemporaryValid(user);
            if (!Objects.equals(expectedVersion, user.getCredentialVersion())) throw error("STAFF_CREDENTIAL_BUSY");
            bumpVersion(user);
            user.setCredentialsChangedAt(clock.millis());
            user.setCredentialOperation("CHANGE"); user.setPasswordChangeRequired(true); user.setTemporaryPasswordExpiresAt(0L); clearReset(user); return null;
        });
        completePassword(uid, password);
    }
    private void completePassword(String uid, String password) throws Exception {
        try {
            identity.setPasswordAndRevoke(uid, password);
            store.transact(data -> {
                User user = data.users().get(uid); user.setCredentialsChangedAt(clock.millis()); user.setPasswordChangeRequired(false); user.setTemporaryPasswordExpiresAt(null);
                user.setCredentialOperation(null); clearReset(user); return null;
            });
        } catch (Exception failure) {
            // Fail closed after a partial provider mutation. Recovery can issue a new single-use link.
            store.transact(data -> { data.users().get(uid).setCredentialOperation(null); return null; });
            throw new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE, "STAFF_AUTH_UNAVAILABLE", "Không thể hoàn tất đổi mật khẩu. Vui lòng yêu cầu cấp lại mật khẩu.");
        }
    }
    private void requireTemporaryValid(User user) {
        if (Boolean.TRUE.equals(user.getPasswordChangeRequired()) && (user.getTemporaryPasswordExpiresAt() == null || user.getTemporaryPasswordExpiresAt() <= clock.millis()))
            throw error("STAFF_TEMP_EXPIRED");
    }
    private void requireCooldown(Long last) { if (last != null && clock.millis() - last < COOLDOWN) throw error("STAFF_RATE_LIMITED"); }
    private void requireIdle(User user) { if (user.getCredentialOperation() != null) throw error("STAFF_CREDENTIAL_BUSY"); }
    private void requireAdmin(StaffStore.State data, String uid) {
        User actor = data.users().get(uid);
        if (actor == null || actor.getRole() != UserRole.ADMIN || Boolean.FALSE.equals(actor.getStaffActive())) throw error("ACCESS_DENIED");
    }
    private User requireStaff(StaffStore.State data, String uid) {
        User user = data.users().get(uid);
        if (user == null || !isStaff(user) || Boolean.FALSE.equals(user.getStaffActive())) throw error("STAFF_NOT_FOUND"); return user;
    }
    private User requirePasswordOwner(StaffStore.State data, String uid) {
        User user = data.users().get(uid);
        if (user == null || Boolean.FALSE.equals(user.getStaffActive()) || !(isStaff(user)
                || (Boolean.TRUE.equals(user.getStaffProvisioned()) && Boolean.TRUE.equals(user.getPasswordChangeRequired())))) throw error("ACCESS_DENIED");
        return user;
    }
    private boolean canRecover(User user) { return isStaff(user) || Boolean.TRUE.equals(user.getStaffProvisioned()); }
    private boolean isStaff(User user) { return user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.EMPLOYEE; }
    private boolean hasEmail(StaffStore.State data, String email) { return data.users().values().stream().anyMatch(u -> email.equalsIgnoreCase(u.getEmail())); }
    private void bumpVersion(User user) { user.setCredentialVersion(user.getCredentialVersion() == null ? 1L : user.getCredentialVersion() + 1); }
    private void clearReset(User user) { user.setStaffResetTokenHash(null); user.setStaffResetExpiresAt(null); }
    private String secret() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    private static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception failure) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    private static String text(String value, int max) { if (value == null || value.trim().isEmpty() || value.trim().length() > max) throw error("STAFF_INVALID"); return value.trim(); }
    private static String email(String value) {
        String result = text(value, 254).toLowerCase(Locale.ROOT);
        if (!result.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw error("STAFF_INVALID"); return result;
    }
    private static void validatePassword(String value) {
        if (value == null || value.length() < 12 || value.length() > 128 || !value.matches("(?s).*[a-z].*")
                || !value.matches("(?s).*[A-Z].*") || !value.matches("(?s).*[0-9].*")) throw error("STAFF_PASSWORD_INVALID");
    }
    static ApiCodeException error(String code) {
        HttpStatus status = switch (code) {
            case "ACCESS_DENIED", "STAFF_TEMP_EXPIRED" -> HttpStatus.FORBIDDEN;
            case "STAFF_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "STAFF_EMAIL_EXISTS", "STAFF_CREDENTIAL_BUSY" -> HttpStatus.CONFLICT;
            case "STAFF_RATE_LIMITED" -> HttpStatus.TOO_MANY_REQUESTS;
            default -> HttpStatus.BAD_REQUEST;
        };
        return new ApiCodeException(status, code, "Không thể thực hiện thao tác tài khoản nhân viên");
    }
}
