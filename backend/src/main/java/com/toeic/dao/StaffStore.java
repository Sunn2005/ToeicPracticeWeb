package com.toeic.dao;

import com.toeic.model.StaffGroup;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import java.util.Map;
import java.util.function.Function;

public interface StaffStore {
    record State(Map<String, User> users, Map<String, StaffGroup> groups) {
        public void migrateLegacy() {
            groups.values().forEach(group -> group.setPermissions(
                    com.toeic.service.StaffPermissions.withoutRetired(group.getPermissions())));
            users.values().forEach(user -> {
                if ((user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.EMPLOYEE)
                        && user.getStaffGroupId() == null) {
                    user.setStaffGroupId(user.getRole() == UserRole.ADMIN ? "admin" : "creators");
                    user.setStaffActive(true);
                }
            });
        }
    }
    State read() throws Exception;
    <T> T transact(Function<State, T> mutation) throws Exception;
    StaffGroup findGroup(String id) throws Exception;
}
