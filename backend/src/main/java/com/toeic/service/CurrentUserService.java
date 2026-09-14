package com.toeic.service;

import com.toeic.dao.UserDao;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class CurrentUserService {

    private final FirebaseAuthenticationService authenticationService;
    private final UserDao userDao;

    public CurrentUserService(
            FirebaseAuthenticationService authenticationService,
            UserDao userDao
    ) {
        this.authenticationService = authenticationService;
        this.userDao = userDao;
    }

    public User requireUser(String authorization) throws Exception {
        FirebaseIdentity identity = authenticationService.requireIdentity(authorization);
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

    public Map<String, Object> toResponse(User user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("uid", user.getUid());
        response.put("email", user.getEmail());
        response.put("displayName", user.getDisplayName());
        response.put("photoUrl", user.getPhotoUrl());
        response.put("role", user.getRole() == null ? UserRole.USER.name() : user.getRole().name());
        response.put("createdAt", user.getCreatedAt());
        response.put("lastLoginAt", user.getLastLoginAt());
        return response;
    }

}
