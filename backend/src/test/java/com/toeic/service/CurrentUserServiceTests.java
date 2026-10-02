package com.toeic.service;

import com.toeic.dao.UserDao;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CurrentUserServiceTests {

    @Test
    void createsAUserProfileWithTheDefaultUserRole() throws Exception {
        FirebaseAuthenticationService authenticationService = mock(FirebaseAuthenticationService.class);
        UserDao userDao = mock(UserDao.class);
        CurrentUserService service = new CurrentUserService(authenticationService, userDao);
        when(authenticationService.requireIdentity("Bearer token")).thenReturn(
                new FirebaseIdentity("uid-1", "user@example.com", "User", null, "ADMIN")
        );
        when(userDao.findByUid("uid-1")).thenReturn(Optional.empty());

        User result = service.requireUser("Bearer token");

        assertEquals(UserRole.USER, result.getRole());
        verify(userDao).save(any(User.class));
    }

    @Test
    void repairsLegacyProfileWithoutRoleAsUser() throws Exception {
        FirebaseAuthenticationService authenticationService = mock(FirebaseAuthenticationService.class);
        UserDao userDao = mock(UserDao.class);
        CurrentUserService service = new CurrentUserService(authenticationService, userDao);
        User legacyUser = new User();
        legacyUser.setUid("uid-legacy");
        when(authenticationService.requireIdentity("Bearer token")).thenReturn(
                new FirebaseIdentity("uid-legacy", null, null, null, "ADMIN")
        );
        when(userDao.findByUid("uid-legacy")).thenReturn(Optional.of(legacyUser));

        User result = service.requireUser("Bearer token");

        assertEquals(UserRole.USER, result.getRole());
        verify(userDao).save(legacyUser);
    }

    @Test
    void updatesTheLearnerProfileAndTargetScore() throws Exception {
        FirebaseAuthenticationService authenticationService = mock(FirebaseAuthenticationService.class);
        UserDao userDao = mock(UserDao.class);
        CurrentUserService service = new CurrentUserService(authenticationService, userDao);
        User user = new User();
        user.setUid("uid-1");
        user.setEmail("user@example.com");
        user.setRole(UserRole.USER);
        when(userDao.findByUid("uid-1")).thenReturn(Optional.of(user));

        var response = service.updateProfile("uid-1", "Minh Anh", null, 800);

        assertEquals("Minh Anh", response.get("displayName"));
        assertEquals(800, response.get("targetScore"));
        verify(userDao).save(user);
    }

}
