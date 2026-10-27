package com.toeic.service;

import com.toeic.model.StaffGroup;
import com.toeic.controller.ApiCodeException;
import org.springframework.http.HttpStatus;
import java.util.*;

public final class StaffPermissions {
    private StaffPermissions() {}
    public record Feature(String id, List<String> actions) {}
    public static final List<Feature> CATALOG = List.of(
            new Feature("dashboard", List.of("view")),
            new Feature("staff", List.of("view", "add", "edit", "delete")),
            new Feature("tests", List.of("view", "add", "edit", "delete")),
            new Feature("reviews", List.of("view", "edit")),
            new Feature("history", List.of("view")),
            new Feature("orders", List.of("view")),
            new Feature("revenue", List.of("view")));
    public static final List<String> ALL = CATALOG.stream()
            .flatMap(f -> f.actions().stream().map(a -> f.id() + "." + a)).toList();
    public static final List<String> CREATOR = List.of("dashboard.view", "tests.view", "tests.add", "tests.edit", "tests.delete");

    /** Ignore only retired console permissions in previously stored groups. */
    public static List<String> withoutRetired(List<String> permissions) {
        if (permissions == null) return null;
        return permissions.stream().filter(permission -> permission == null || !List.of(
                "subscriptions.view", "subscriptions.grant", "subscriptions.revoke").contains(permission)).toList();
    }

    public static List<String> validate(List<String> requested) {
        if (requested == null || requested.stream().anyMatch(p -> !ALL.contains(p) || p.startsWith("staff."))) {
            throw new ApiCodeException(HttpStatus.BAD_REQUEST, "STAFF_INVALID", "Quyền không hợp lệ");
        }
        Set<String> result = new LinkedHashSet<>(requested);
        for (String p : requested) result.add(p.substring(0, p.indexOf('.')) + ".view");
        return ALL.stream().filter(result::contains).toList();
    }
    public static Map<String, StaffGroup> defaults() {
        Map<String, StaffGroup> groups = new LinkedHashMap<>();
        add(groups, "admin", "Quản trị", "ADMIN", ALL);
        add(groups, "creators", "Nhân viên tạo đề", "TAO_DE", CREATOR);
        add(groups, "reviewers", "Nhân viên xét duyệt", "XET_DUYET", List.of("dashboard.view", "reviews.view", "reviews.edit", "history.view"));
        add(groups, "business", "Kinh doanh", "KINH_DOANH", List.of("dashboard.view", "orders.view", "revenue.view"));
        return groups;
    }
    private static void add(Map<String, StaffGroup> groups, String id, String name, String code, List<String> permissions) {
        StaffGroup group = new StaffGroup();
        group.setId(id); group.setName(name); group.setCode(code); group.setDescription("");
        group.setPermissions(new ArrayList<>(permissions)); groups.put(id, group);
    }
}
