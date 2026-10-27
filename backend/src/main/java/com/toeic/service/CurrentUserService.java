package com.toeic.service;

import com.toeic.dao.UserDao;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class CurrentUserService {

    private static final Pattern PHONE_NUMBER_PATTERN = Pattern.compile("^\\+?[0-9]{8,15}$");
    private static final Set<String> ALLOWED_GENDERS = Set.of(
            "MALE",
            "FEMALE",
            "OTHER",
            "PREFER_NOT_TO_SAY"
    );

    private final UserDao userDao;
    private final StaffAccessService staffAccessService;
    private final SubscriptionService subscriptionService;

    public CurrentUserService(UserDao userDao, SubscriptionService subscriptionService, StaffAccessService staffAccessService) {
        this.userDao = userDao;
        this.staffAccessService = staffAccessService;
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
        response.put("phoneNumber", user.getPhoneNumber());
        response.put("dateOfBirth", user.getDateOfBirth());
        response.put("gender", user.getGender());
        response.put("role", user.getRole() == null ? UserRole.USER.name() : user.getRole().name());
        response.put("createdAt", user.getCreatedAt());
        response.put("lastLoginAt", user.getLastLoginAt());
        response.put("consoleAccess", staffAccessService.forUser(user));
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
            Integer targetScore,
            String phoneNumber,
            String dateOfBirth,
            String gender
    ) throws Exception {
        User user = userDao.findByUid(uid).orElseThrow();
        if (displayName == null || displayName.isBlank() || displayName.trim().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Họ và tên phải có từ 1 đến 80 ký tự");
        }
        if (targetScore != null && (targetScore < 10 || targetScore > 990 || targetScore % 5 != 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mục tiêu TOEIC phải từ 10 đến 990 và chia hết cho 5");
        }
        String normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
        String normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirth);
        String normalizedGender = normalizeGender(gender);

        user.setDisplayName(displayName.trim());
        user.setPhotoUrl(photoUrl == null || photoUrl.isBlank() ? null : photoUrl.trim());
        user.setTargetScore(targetScore);
        user.setPhoneNumber(normalizedPhoneNumber);
        user.setDateOfBirth(normalizedDateOfBirth);
        user.setGender(normalizedGender);
        userDao.save(user);
        return toResponse(user);
    }

    private String normalizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return null;
        }
        String normalized = phoneNumber.trim();
        if (!PHONE_NUMBER_PATTERN.matcher(normalized).matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số điện thoại phải gồm 8 đến 15 chữ số và có thể bắt đầu bằng dấu +"
            );
        }
        return normalized;
    }

    private String normalizeDateOfBirth(String dateOfBirth) {
        if (dateOfBirth == null || dateOfBirth.isBlank()) {
            return null;
        }
        String normalized = dateOfBirth.trim();
        try {
            LocalDate parsed = LocalDate.parse(normalized);
            if (parsed.isAfter(LocalDate.now(ZoneOffset.UTC))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ngày sinh không được ở tương lai");
            }
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ngày sinh phải có định dạng YYYY-MM-DD");
        }
        return normalized;
    }

    private String normalizeGender(String gender) {
        if (gender == null || gender.isBlank()) {
            return null;
        }
        String normalized = gender.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_GENDERS.contains(normalized)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giới tính phải là MALE, FEMALE, OTHER hoặc PREFER_NOT_TO_SAY"
            );
        }
        return normalized;
    }

}
