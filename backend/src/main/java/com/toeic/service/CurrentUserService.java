package com.toeic.service;

import com.toeic.dao.UserDao;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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
                existing.setRole(resolveClaimedRole(identity.claimedRole()));
            }
            return existing;
        }

        long now = System.currentTimeMillis();
        User user = new User();
        user.setUid(identity.uid());
        user.setEmail(identity.email());
        user.setDisplayName(identity.displayName());
        user.setPhotoUrl(identity.photoUrl());
        user.setRole(resolveClaimedRole(identity.claimedRole()));
        user.setCreatedAt(now);
        user.setLastLoginAt(now);
        userDao.save(user);
        return user;
    }

    public User requireRole(String authorization, UserRole... allowedRoles) throws Exception {
        User user = requireUser(authorization);
        if (!Set.of(allowedRoles).contains(user.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền thực hiện thao tác này"
            );
        }
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

    private UserRole resolveClaimedRole(String claimedRole) {
        if (claimedRole == null || claimedRole.isBlank()) {
            return UserRole.USER;
        }
        try {
            return UserRole.valueOf(claimedRole.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return UserRole.USER;
        }
    }
}
