package com.toeic.service;

import com.toeic.dao.StaffStore;
import com.toeic.model.StaffGroup;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.controller.ApiCodeException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class StaffManagementService {
    private final StaffStore store;
    public StaffManagementService(StaffStore store) { this.store = store; }
    public record GroupRequest(String name, String code, String description, List<String> permissions, Long version) {}
    public record MemberRequest(String uid, String groupId, Boolean active, String notes, Long version) {}
    public record Member(String uid, String email, String displayName, String groupId, boolean active, String notes, long version, String phoneNumber, boolean provisioned, String emailStatus, Long lastSentAt, boolean passwordChangeRequired) {}
    public record Directory(List<StaffGroup> groups, List<Member> members, List<StaffPermissions.Feature> catalog) {}

    public Directory directory() throws Exception {
        var data = store.read();
        return new Directory(data.groups().values().stream().sorted(Comparator.comparing(g -> "admin".equals(g.getId()) ? "" : g.getName())).toList(),
                data.users().values().stream().filter(this::isStaff).map(this::member)
                        .sorted(Comparator.comparing(m -> Objects.toString(m.email(), ""))).toList(), StaffPermissions.CATALOG);
    }
    public Member lookup(String email) throws Exception {
        String value = text(email, 254, true);
        if (!value.contains("@")) throw error("STAFF_INVALID");
        return store.read().users().values().stream().filter(u -> value.equalsIgnoreCase(u.getEmail()))
                .findFirst().map(this::member).orElseThrow(() -> error("STAFF_NOT_FOUND"));
    }
    public StaffGroup saveGroup(String actor, String id, GroupRequest request) throws Exception {
        String name = text(request.name(), 80, true), code = text(request.code(), 40, true).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z][A-Z0-9_]{1,39}")) throw error("STAFF_INVALID");
        String description = text(request.description(), 500, false);
        List<String> permissions = "admin".equals(id) ? StaffPermissions.ALL : StaffPermissions.validate(request.permissions());
        String target = id == null ? UUID.randomUUID().toString() : id;
        return store.transact(data -> {
            requireAdmin(data, actor);
            StaffGroup old = data.groups().get(target);
            if (id != null) { if (old == null) throw error("STAFF_NOT_FOUND"); requireVersion(request.version(), old.getVersion()); }
            if ("admin".equals(id) && (!"ADMIN".equals(code) || !new HashSet<>(StaffPermissions.ALL).equals(new HashSet<>(Objects.requireNonNullElse(request.permissions(), List.of()))))) throw error("STAFF_SELF_PROTECTED");
            if (data.groups().values().stream().anyMatch(g -> !g.getId().equals(target) && g.getCode().equalsIgnoreCase(code))) throw error("STAFF_CONFLICT");
            StaffGroup group = new StaffGroup(); group.setId(target); group.setName(name); group.setCode(code);
            group.setDescription(description); group.setPermissions(permissions); group.setVersion(old == null ? 1L : version(old.getVersion()) + 1);
            data.groups().put(target, group); return group;
        });
    }
    public void deleteGroup(String actor, String id, Long version) throws Exception {
        store.transact(data -> {
            requireAdmin(data, actor);
            if ("admin".equals(id)) throw error("STAFF_SELF_PROTECTED");
            StaffGroup group = data.groups().get(id); if (group == null) throw error("STAFF_NOT_FOUND");
            requireVersion(version, group.getVersion());
            if (data.users().values().stream().anyMatch(u -> isStaff(u) && id.equals(u.getStaffGroupId()))) throw error("STAFF_GROUP_NOT_EMPTY");
            data.groups().remove(id); return null;
        });
    }
    public Member saveMember(String actor, String uid, MemberRequest request, boolean create) throws Exception {
        String target = text(uid, 128, true), groupId = text(request.groupId(), 128, true);
        String notes = text(request.notes(), 1000, false);
        if (request.active() == null) throw error("STAFF_INVALID");
        return store.transact(data -> {
            requireAdmin(data, actor);
            User user = data.users().get(target); if (user == null || !data.groups().containsKey(groupId)) throw error("STAFF_NOT_FOUND");
            if (create && isStaff(user)) throw error("STAFF_CONFLICT");
            if (!create && !isStaff(user)) throw error("STAFF_NOT_FOUND");
            requireVersion(request.version(), user.getStaffVersion());
            if (actor.equals(target) && (!"admin".equals(groupId) || !request.active())) throw error("STAFF_SELF_PROTECTED");
            user.setRole("admin".equals(groupId) ? UserRole.ADMIN : UserRole.EMPLOYEE);
            user.setStaffGroupId(groupId); user.setStaffActive(request.active()); user.setStaffNotes(notes);
            user.setStaffVersion(version(user.getStaffVersion()) + 1);
            requireActiveAdmin(data); return member(user);
        });
    }
    public void deleteMember(String actor, String uid, Long version) throws Exception {
        store.transact(data -> {
            requireAdmin(data, actor);
            if (actor.equals(uid)) throw error("STAFF_SELF_PROTECTED");
            User user = data.users().get(uid); if (user == null || !isStaff(user)) throw error("STAFF_NOT_FOUND");
            requireVersion(version, user.getStaffVersion());
            user.setRole(UserRole.USER); user.setStaffGroupId(null); user.setStaffActive(null); user.setStaffNotes(null);
            user.setStaffVersion(version(user.getStaffVersion()) + 1); requireActiveAdmin(data); return null;
        });
    }
    private void requireAdmin(StaffStore.State data, String uid) {
        User actor = data.users().get(uid);
        if (actor == null || actor.getRole() != UserRole.ADMIN || Boolean.FALSE.equals(actor.getStaffActive()))
            throw new ApiCodeException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Không có quyền quản trị");
    }
    private void requireActiveAdmin(StaffStore.State data) {
        if (data.users().values().stream().noneMatch(u -> u.getRole() == UserRole.ADMIN && !Boolean.FALSE.equals(u.getStaffActive()))) throw error("STAFF_SELF_PROTECTED");
    }
    private boolean isStaff(User user) { return user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.EMPLOYEE; }
    private Member member(User user) { return new Member(user.getUid(), user.getEmail(), user.getDisplayName(), user.getStaffGroupId(), !Boolean.FALSE.equals(user.getStaffActive()), user.getStaffNotes(), version(user.getStaffVersion()), user.getPhoneNumber(), Boolean.TRUE.equals(user.getStaffProvisioned()), user.getCredentialEmailStatus(), user.getCredentialLastSentAt(), Boolean.TRUE.equals(user.getPasswordChangeRequired())); }
    private long version(Long value) { return value == null ? 0 : value; }
    private void requireVersion(Long requested, Long actual) { if (requested == null || requested != version(actual)) throw error("STAFF_CONFLICT"); }
    private String text(String value, int max, boolean required) {
        String normalized = value == null ? "" : value.trim();
        if ((required && normalized.isEmpty()) || normalized.length() > max) throw error("STAFF_INVALID"); return normalized;
    }
    private ApiCodeException error(String code) {
        HttpStatus status = switch (code) {
            case "STAFF_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "STAFF_INVALID" -> HttpStatus.BAD_REQUEST;
            case "STAFF_SELF_PROTECTED" -> HttpStatus.FORBIDDEN;
            default -> HttpStatus.CONFLICT;
        };
        return new ApiCodeException(status, code, "Không thể thực hiện thao tác quản lý nhân viên");
    }
}
