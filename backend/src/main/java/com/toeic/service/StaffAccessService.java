package com.toeic.service;

import com.toeic.dao.StaffStore;
import com.toeic.dao.UserDao;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class StaffAccessService {
    private final StaffStore store;
    private final UserDao users;
    public StaffAccessService(StaffStore store, UserDao users) { this.store = store; this.users = users; }
    public record Access(boolean active, String groupId, List<String> permissions) {}
    public Access forUid(String uid) throws Exception {
        return forUser(users.findByUid(uid).orElse(null));
    }
    public Access forUser(User user) throws Exception {
        if (user == null || (user.getRole() != UserRole.ADMIN && user.getRole() != UserRole.EMPLOYEE))
            return new Access(false, null, List.of());
        String groupId = user.getStaffGroupId() == null
                ? (user.getRole() == UserRole.ADMIN ? "admin" : "creators") : user.getStaffGroupId();
        if (Boolean.FALSE.equals(user.getStaffActive())) return new Access(false, groupId, List.of());
        if (user.getRole() == UserRole.ADMIN && "admin".equals(groupId)) return new Access(true, groupId, StaffPermissions.ALL);
        var group = store.findGroup(groupId);
        if (group == null || "admin".equals(groupId)) return new Access(false, groupId, List.of());
        return new Access(true, groupId, StaffPermissions.validate(StaffPermissions.withoutRetired(group.getPermissions())));
    }
}
