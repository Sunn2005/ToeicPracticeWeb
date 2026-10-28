package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.StaffStore;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StaffCredentialServiceTests {
    private StaffStore store;
    private StaffStore.State state;
    private StaffIdentityGateway identity;
    private StaffMailGateway mail;
    private StaffCredentialService service;
    private final MutableClock clock = new MutableClock();
    static class MutableClock extends Clock {
        long now = 1_800_000_000_000L;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(now); }
    }
    @BeforeEach void setup() throws Exception {
        store = mock(StaffStore.class); identity = mock(StaffIdentityGateway.class); mail = mock(StaffMailGateway.class);
        state = new StaffStore.State(new HashMap<>(), StaffPermissions.defaults());
        User admin = new User(); admin.setUid("admin"); admin.setRole(UserRole.ADMIN); state.users().put("admin", admin);
        when(store.read()).thenReturn(state);
        when(store.transact(any())).thenAnswer(call -> { Function<StaffStore.State, Object> action = call.getArgument(0); return action.apply(state); });
        when(identity.createDisabled(anyString(), anyString(), anyString())).thenReturn("new-staff");
        service = new StaffCredentialService(store, identity, mail, clock);
    }
    private StaffCredentialService.CreateRequest request() {
        return new StaffCredentialService.CreateRequest(" Staff Name ", "+84912345678", " STAFF@example.test ", "business", true, "Contact only");
    }
    private User create() throws Exception { service.create("admin", request()); return state.users().get("new-staff"); }
    private void code(String expected, org.junit.jupiter.api.function.Executable action) {
        assertEquals(expected, assertThrows(ApiCodeException.class, action).getCode());
    }
    @Test void adminCreatesNewAccountAndOnlyEmailsPassword() throws Exception {
        var result = service.create("admin", request()); User user = state.users().get(result.uid());
        assertEquals("SENT", result.emailStatus()); assertEquals("staff@example.test", user.getEmail());
        assertEquals("Staff Name", user.getDisplayName()); assertEquals("+84912345678", user.getPhoneNumber());
        assertEquals(UserRole.EMPLOYEE, user.getRole()); assertTrue(user.getPasswordChangeRequired());
        assertEquals(clock.millis() + Duration.ofHours(24).toMillis(), user.getTemporaryPasswordExpiresAt());
        assertNull(user.getCredentialOperation());
        var password = ArgumentCaptor.forClass(String.class);
        verify(identity).createDisabled(eq(user.getEmail()), eq(user.getDisplayName()), password.capture());
        verify(mail).credentials(user.getEmail(), password.getValue());
        assertFalse(result.toString().contains(password.getValue()));
        assertFalse(user.toString().contains(password.getValue()));
    }
    @Test void firestoreAndFirebaseDuplicatesAreRejectedWithoutCreatingAccounts() throws Exception {
        User existing = new User(); existing.setEmail("STAFF@example.test"); state.users().put("old", existing);
        code("STAFF_EMAIL_EXISTS", () -> service.create("admin", request())); verifyNoInteractions(identity);
        state.users().remove("old"); when(identity.emailExists("staff@example.test")).thenReturn(true);
        code("STAFF_EMAIL_EXISTS", () -> service.create("admin", request()));
        verify(identity, never()).createDisabled(anyString(), anyString(), anyString());
    }
    @Test void failedEmailKeepsCreatedAccountAndResendRotatesAndRevokesAfterCooldown() throws Exception {
        doThrow(new IllegalStateException()).when(mail).credentials(anyString(), anyString());
        var result = service.create("admin", request()); assertEquals("FAILED", result.emailStatus());
        assertNotNull(state.users().get(result.uid())); verify(identity, never()).delete(anyString());
        code("STAFF_RATE_LIMITED", () -> service.resend("admin", result.uid()));
        clock.now += 60_000; doNothing().when(mail).credentials(anyString(), anyString());
        assertEquals("SENT", service.resend("admin", result.uid()).emailStatus());
        var password = ArgumentCaptor.forClass(String.class); verify(mail, times(2)).credentials(anyString(), password.capture());
        assertNotEquals(password.getAllValues().get(0), password.getAllValues().get(1));
        verify(identity).setPasswordAndRevoke(result.uid(), password.getAllValues().get(1));
    }
    @Test void providerEnableFailureIsRecoverableWithoutCreatingAgain() throws Exception {
        doThrow(new IllegalStateException()).when(identity).enable("new-staff");
        assertEquals("FAILED", service.create("admin", request()).emailStatus());
        assertNull(state.users().get("new-staff").getCredentialOperation());
        clock.now += 60_000; doNothing().when(identity).enable("new-staff");
        assertEquals("SENT", service.resend("admin", "new-staff").emailStatus());
        verify(identity, times(1)).createDisabled(anyString(), anyString(), anyString());
    }
    @Test void transactionFailureDeletesOnlyNewUncommittedIdentity() throws Exception {
        doThrow(new IllegalStateException()).when(store).transact(any());
        assertThrows(IllegalStateException.class, () -> service.create("admin", request()));
        verify(identity).delete("new-staff");
    }
    @Test void onlyAdminCanCreateAndPhoneIsValidatedBeforeCreating() {
        code("ACCESS_DENIED", () -> service.create("missing", request()));
        code("STAFF_INVALID", () -> service.create("admin", new StaffCredentialService.CreateRequest("Staff", "abc", "staff@example.test", "business", true, "")));
        verifyNoInteractions(identity, mail);
    }
    @Test void resetTokenIsHashedSingleUseAndSuccessClearsMandatoryChange() throws Exception {
        User user = create(); service.requestReset(user.getEmail());
        var token = ArgumentCaptor.forClass(String.class); verify(mail).resetLink(eq(user.getEmail()), token.capture());
        assertNotEquals(token.getValue(), user.getStaffResetTokenHash());
        service.reset(user.getEmail(), token.getValue(), "NewPassword123!");
        verify(identity).setPasswordAndRevoke(user.getUid(), "NewPassword123!");
        assertFalse(user.getPasswordChangeRequired()); assertNull(user.getStaffResetTokenHash());
        code("STAFF_RESET_INVALID", () -> service.reset(user.getEmail(), token.getValue(), "OtherPassword123!"));
    }
    @Test void expiryAndNewRequestInvalidateOldResetLink() throws Exception {
        User user = create(); service.requestReset(user.getEmail());
        var tokens = ArgumentCaptor.forClass(String.class); verify(mail).resetLink(eq(user.getEmail()), tokens.capture());
        String first = tokens.getValue(); clock.now += 60_000; service.requestReset(user.getEmail());
        verify(mail, times(2)).resetLink(eq(user.getEmail()), tokens.capture());
        code("STAFF_RESET_INVALID", () -> service.reset(user.getEmail(), first, "NewPassword123!"));
        clock.now += Duration.ofHours(1).toMillis();
        code("STAFF_RESET_INVALID", () -> service.reset(user.getEmail(), tokens.getValue(), "NewPassword123!"));
    }
    @Test void unknownInactiveAndRepeatedRecoveryRequestsAreSilent() throws Exception {
        User user = create(); clearInvocations(mail);
        service.requestReset("missing@example.test"); verifyNoInteractions(mail);
        service.requestReset(user.getEmail()); service.requestReset(user.getEmail());
        verify(mail, times(1)).resetLink(eq(user.getEmail()), anyString());
        clock.now += 60_000; user.setStaffActive(false); service.requestReset(user.getEmail());
        verify(mail, times(1)).resetLink(eq(user.getEmail()), anyString());
    }
    @Test void currentPasswordIsVerifiedAndTemporaryExpiryCannotBeBypassed() throws Exception {
        User user = create(); service.change(user.getUid(), "old", "NewPassword123!");
        verify(identity).verifyPassword(user.getUid(), user.getEmail(), "old");
        verify(identity).setPasswordAndRevoke(user.getUid(), "NewPassword123!"); assertFalse(user.getPasswordChangeRequired());
        user.setPasswordChangeRequired(true); user.setTemporaryPasswordExpiresAt(clock.millis());
        code("STAFF_TEMP_EXPIRED", () -> service.change(user.getUid(), "old", "NewPassword456!"));
    }
    @Test void wrongCurrentPasswordDoesNotLockAccountOrChangeCredentials() throws Exception {
        User user = create(); user.setPasswordChangeRequired(false); user.setTemporaryPasswordExpiresAt(null);
        doThrow(new ApiCodeException(org.springframework.http.HttpStatus.BAD_REQUEST, "STAFF_PASSWORD_INCORRECT", "Wrong")).when(identity).verifyPassword(anyString(), anyString(), anyString());
        code("STAFF_PASSWORD_INCORRECT", () -> service.change(user.getUid(), "wrong", "NewPassword123!"));
        assertFalse(user.getPasswordChangeRequired()); assertNull(user.getCredentialOperation());
        verify(identity, never()).setPasswordAndRevoke(anyString(), anyString());
    }
    @Test void partialPasswordFailureRemainsRestrictedButAllowsRecovery() throws Exception {
        User user = create();
        doThrow(new IllegalStateException()).when(identity).setPasswordAndRevoke(anyString(), anyString());
        code("STAFF_AUTH_UNAVAILABLE", () -> service.change(user.getUid(), "old", "NewPassword123!"));
        assertTrue(user.getPasswordChangeRequired()); assertEquals(0L, user.getTemporaryPasswordExpiresAt()); assertNull(user.getCredentialOperation());
        service.requestReset(user.getEmail()); verify(mail).resetLink(eq(user.getEmail()), anyString());
    }
    @Test void resendInvalidatesPreviouslyIssuedRecoveryLinks() throws Exception {
        User user = create(); service.requestReset(user.getEmail());
        var token = ArgumentCaptor.forClass(String.class); verify(mail).resetLink(eq(user.getEmail()), token.capture());
        clock.now += 60_000; service.resend("admin", user.getUid());
        code("STAFF_RESET_INVALID", () -> service.reset(user.getEmail(), token.getValue(), "NewPassword123!"));
    }
    @Test void demotionDoesNotStrandAnOwnerWithAnUnchangedTemporaryPassword() throws Exception {
        User user = create(); user.setRole(UserRole.USER); user.setStaffActive(null); user.setStaffGroupId(null);
        service.change(user.getUid(), "temporary", "NewPassword123!");
        assertFalse(user.getPasswordChangeRequired()); assertEquals(UserRole.USER, user.getRole());
        service.requestReset(user.getEmail()); verify(mail).resetLink(eq(user.getEmail()), anyString());
        code("ACCESS_DENIED", () -> service.change(user.getUid(), "old", "OtherPassword123!"));
        code("STAFF_NOT_FOUND", () -> service.resend("admin", user.getUid()));
    }
    @Test void ordinaryLearnerCannotChangePasswordThroughStaffEndpointOrReceiveStaffReset() throws Exception {
        User user = new User(); user.setUid("learner"); user.setEmail("learner@example.test"); user.setRole(UserRole.USER); state.users().put("learner", user);
        code("ACCESS_DENIED", () -> service.change("learner", "old", "NewPassword123!"));
        service.requestReset(user.getEmail()); verifyNoInteractions(mail, identity);
    }

    @Test void concurrentResendOrResetMakesEarlierCurrentPasswordVerificationStale() throws Exception {
        User user = create();
        doAnswer(call -> { user.setCredentialVersion(1L); return null; }).when(identity).verifyPassword(anyString(), anyString(), anyString());
        code("STAFF_CREDENTIAL_BUSY", () -> service.change(user.getUid(), "old", "NewPassword123!"));
        verify(identity, never()).setPasswordAndRevoke(anyString(), anyString());
    }
    @Test void duplicateAppearingDuringProvisioningRollsBackOnlyTheNewIdentity() throws Exception {
        when(identity.createDisabled(anyString(), anyString(), anyString())).thenAnswer(call -> {
            User old = new User(); old.setUid("original"); old.setEmail("staff@example.test"); old.setRole(UserRole.USER);
            state.users().put(old.getUid(), old); return "new-staff";
        });
        code("STAFF_EMAIL_EXISTS", () -> service.create("admin", request()));
        assertEquals(UserRole.USER, state.users().get("original").getRole());
        verify(identity).delete("new-staff"); assertFalse(state.users().containsKey("new-staff"));
    }
    @Test void resendProviderFailureLeavesAccountRecoverableAndNeverSendsAnUnusablePassword() throws Exception {
        User user = create(); clearInvocations(mail); clock.now += 60_000;
        doThrow(new IllegalStateException()).when(identity).setPasswordAndRevoke(anyString(), anyString());
        assertEquals("FAILED", service.resend("admin", user.getUid()).emailStatus());
        assertTrue(user.getPasswordChangeRequired()); assertEquals(0L, user.getTemporaryPasswordExpiresAt());
        assertNull(user.getCredentialOperation()); verifyNoInteractions(mail);
        service.requestReset(user.getEmail()); verify(mail).resetLink(eq(user.getEmail()), anyString());
    }

    @Test void resendRevocationEpochCoversSessionsCreatedWhileProviderCallWasRunning() throws Exception {
        User user = create(); clock.now += 60_000;
        doAnswer(call -> { clock.now += 2_000; return null; }).when(identity).setPasswordAndRevoke(anyString(), anyString());
        service.resend("admin", user.getUid());
        assertEquals(clock.millis(), user.getCredentialsChangedAt());
    }

}
