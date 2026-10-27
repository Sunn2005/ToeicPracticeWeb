package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.StaffStore;
import com.toeic.dao.UserDao;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.function.Function;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class StaffManagementServiceTests {
    private StaffStore store;
    private StaffStore.State state;
    private StaffManagementService service;
    @BeforeEach void setup() throws Exception {
        store = mock(StaffStore.class);
        state = new StaffStore.State(new HashMap<>(), StaffPermissions.defaults());
        user("admin", UserRole.ADMIN); user("creator", UserRole.EMPLOYEE); user("learner", UserRole.USER);
        state.migrateLegacy();
        when(store.read()).thenReturn(state);
        when(store.transact(any())).thenAnswer(invocation -> {
            Function<StaffStore.State, Object> operation = invocation.getArgument(0); return operation.apply(state);
        });
        when(store.findGroup(any())).thenAnswer(invocation -> state.groups().get(invocation.getArgument(0)));
        service = new StaffManagementService(store);
    }
    private User user(String id, UserRole role) {
        User user = new User(); user.setUid(id); user.setEmail(id + "@example.test"); user.setDisplayName(id); user.setRole(role);
        state.users().put(id, user); return user;
    }
    private void code(String expected, org.junit.jupiter.api.function.Executable action) {
        assertEquals(expected, assertThrows(ApiCodeException.class, action).getCode());
    }
    @Test void legacyStaffKeepCreatorAccessAndAdminsStayProtected() throws Exception {
        var access = new StaffAccessService(store, mock(UserDao.class));
        assertEquals(StaffPermissions.CREATOR, access.forUser(state.users().get("creator")).permissions());
        assertEquals(StaffPermissions.ALL, access.forUser(state.users().get("admin")).permissions());
        code("STAFF_SELF_PROTECTED", () -> service.deleteMember("admin", "admin", 0L));
        code("STAFF_SELF_PROTECTED", () -> service.saveMember("admin", "admin", new StaffManagementService.MemberRequest(null, "business", true, "", 0L), false));
        code("STAFF_SELF_PROTECTED", () -> service.saveMember("admin", "admin", new StaffManagementService.MemberRequest(null, "admin", false, "", 0L), false));
        code("STAFF_SELF_PROTECTED", () -> service.deleteGroup("admin", "admin", 0L));
    }
    @Test void accountantCanBeAddedAndRightsChangeOnNextReadWithoutRelogin() throws Exception {
        var group = service.saveGroup("admin", null, new StaffManagementService.GroupRequest("Kế toán", "KE_TOAN", "", List.of("revenue.view", "orders.view"), null));
        var member = service.saveMember("admin", "learner", new StaffManagementService.MemberRequest("learner", group.getId(), true, "", 0L), true);
        var access = new StaffAccessService(store, mock(UserDao.class));
        assertEquals(UserRole.EMPLOYEE, state.users().get("learner").getRole());
        assertTrue(access.forUser(state.users().get("learner")).permissions().contains("revenue.view"));
        assertFalse(access.forUser(state.users().get("learner")).permissions().contains("tests.view"));
        service.saveGroup("admin", group.getId(), new StaffManagementService.GroupRequest(group.getName(), group.getCode(), "", List.of("orders.view"), group.getVersion()));
        assertFalse(access.forUser(state.users().get("learner")).permissions().contains("revenue.view"));
        service.saveMember("admin", "learner", new StaffManagementService.MemberRequest(null, group.getId(), false, "", member.version()), false);
        assertFalse(access.forUser(state.users().get("learner")).active());
    }
    @Test void staleUpdatesDuplicateMembershipAndDeletingPopulatedGroupsAreRejected() throws Exception {
        code("STAFF_CONFLICT", () -> service.saveMember("admin", "creator", new StaffManagementService.MemberRequest("creator", "business", true, "", 0L), true));
        code("STAFF_GROUP_NOT_EMPTY", () -> service.deleteGroup("admin", "creators", 0L));
        var member = service.saveMember("admin", "learner", new StaffManagementService.MemberRequest("learner", "business", true, "", 0L), true);
        code("STAFF_CONFLICT", () -> service.deleteMember("admin", "learner", 0L));
        service.deleteMember("admin", "learner", member.version());
        assertEquals(UserRole.USER, state.users().get("learner").getRole());
        assertNull(state.users().get("learner").getStaffGroupId());
        assertNotNull(state.users().get("learner").getEmail());
    }
    @Test void employeesCannotManageStaffOrAssignAdministrativePermissions() {
        code("ACCESS_DENIED", () -> service.saveMember("creator", "learner", new StaffManagementService.MemberRequest("learner", "business", true, "", 0L), true));
        code("STAFF_INVALID", () -> service.saveGroup("admin", null, new StaffManagementService.GroupRequest("Escalation", "BAD", "", List.of("staff.edit"), null)));
        code("STAFF_INVALID", () -> service.saveGroup("admin", null, new StaffManagementService.GroupRequest("Unknown", "UNKNOWN", "", List.of("revenue.delete"), null)));
        assertEquals(List.of("tests.view", "tests.edit"), StaffPermissions.validate(List.of("tests.edit")));
        code("STAFF_INVALID", () -> StaffPermissions.validate(List.of("subscriptions.grant")));
    }
    @Test void lookupReturnsRegisteredAccountAndRejectsMissingEmail() throws Exception {
        assertEquals("learner", service.lookup("LEARNER@example.test").uid());
        code("STAFF_NOT_FOUND", () -> service.lookup("missing@example.test"));
        code("STAFF_INVALID", () -> service.lookup("invalid"));
    }
    @Test void missingGroupFailsClosedAndBlockedAdminsLoseConsoleAccess() throws Exception {
        var access = new StaffAccessService(store, mock(UserDao.class));
        state.users().get("creator").setStaffGroupId("missing");
        assertFalse(access.forUser(state.users().get("creator")).active());
        state.users().get("admin").setStaffActive(false);
        assertFalse(access.forUser(state.users().get("admin")).active());
        assertFalse(access.forUser(state.users().get("learner")).active());
    }
    @Test void retiredProPermissionsDoNotBreakExistingGroupsOrTheirOtherRights() throws Exception {
        var group = state.groups().get("business");
        group.setPermissions(List.of("revenue.view", "subscriptions.view", "subscriptions.grant", "subscriptions.revoke"));
        var employee = state.users().get("creator");
        employee.setStaffGroupId("business");
        var access = new StaffAccessService(store, mock(UserDao.class));
        assertEquals(List.of("revenue.view"), access.forUser(employee).permissions());
        assertTrue(access.forUser(employee).active());
        state.migrateLegacy();
        assertEquals(List.of("revenue.view"), group.getPermissions());
        var saved = service.saveGroup("admin", "business", new StaffManagementService.GroupRequest(
                group.getName(), group.getCode(), group.getDescription(), group.getPermissions(), group.getVersion()));
        assertEquals(List.of("revenue.view"), saved.getPermissions());
        assertTrue(StaffPermissions.CATALOG.stream().noneMatch(feature -> feature.id().equals("subscriptions")));
        assertTrue(StaffPermissions.ALL.stream().noneMatch(permission -> permission.startsWith("subscriptions.")));
        code("STAFF_INVALID", () -> StaffPermissions.validate(List.of("subscriptions.view")));
    }

}
