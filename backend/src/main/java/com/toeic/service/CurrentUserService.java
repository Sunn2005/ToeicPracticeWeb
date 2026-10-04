package com.toeic.service;

import com.toeic.dao.UserDao;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class CurrentUserService {

    private final UserDao userDao;
    private final SubscriptionService subscriptionService;

    public CurrentUserService(UserDao userDao, SubscriptionService subscriptionService) {
        this.userDao = userDao;
        this.subscriptionService = subscriptionService;
    }

    public User requireUser(FirebaseIdentity identity) throws Exception {
        User existing = userDao.findByUid(identity.uid()).orElse(null);
        if (existing != null) {
            if (existing.getRole() == null) {
                existing.setRole(UserRole.USER);
                userDao.save(existing);
            }
            return existing;
        }

        long now = System.currentTimeMillis();
        User user = new User();
        user.setUid(identity.uid());
        user.setEmail(identity.email());
        user.setDisplayName(identity.displayName());
        user.setPhotoUrl(identity.photoUrl());
        // Firestore users/{uid}.role là nguồn phân quyền duy nhất. Mọi tài khoản
        // mới đều bắt đầu với USER; EMPLOYEE/ADMIN phải được cấp bởi quản trị viên.
        user.setRole(UserRole.USER);
        user.setCreatedAt(now);
        user.setLastLoginAt(now);
        userDao.save(user);
        return user;
    }

    public Map<String, Object> toResponse(User user) throws Exception {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("uid", user.getUid());
        response.put("email", user.getEmail());
        response.put("displayName", user.getDisplayName());
        response.put("photoUrl", user.getPhotoUrl());
        response.put("targetScore", user.getTargetScore());
        response.put("role", user.getRole() == null ? UserRole.USER.name() : user.getRole().name());
        response.put("createdAt", user.getCreatedAt());
        response.put("lastLoginAt", user.getLastLoginAt());
        response.put("subscription", subscriptionService.getSummary(user.getUid()));
        return response;
    }

    public Map<String, Object> getProfile(String uid) throws Exception {
        User user = userDao.findByUid(uid).orElseThrow();
        return toResponse(user);
    }

    public Map<String, Object> updateProfile(
            String uid,
            String displayName,
            String photoUrl,
            Integer targetScore
    ) throws Exception {
        User user = userDao.findByUid(uid).orElseThrow();
        if (displayName == null || displayName.isBlank() || displayName.trim().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Họ và tên phải có từ 1 đến 80 ký tự");
        }
        if (targetScore != null && (targetScore < 10 || targetScore > 990 || targetScore % 5 != 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mục tiêu TOEIC phải từ 10 đến 990 và chia hết cho 5");
        }
        user.setDisplayName(displayName.trim());
        user.setPhotoUrl(photoUrl == null || photoUrl.isBlank() ? null : photoUrl.trim());
        user.setTargetScore(targetScore);
        userDao.save(user);
        return toResponse(user);
    }

}
