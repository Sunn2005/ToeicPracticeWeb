package com.toeic.controller;

import com.toeic.dto.UpdateUserProfileRequest;
import com.toeic.model.enums.UserRole;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.CurrentUserService;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeControllerTests {

    @Test
    void forwardsEditableProfileFieldsForTheAuthenticatedUser() throws Exception {
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        MeController controller = new MeController(currentUserService);
        ToeicUserPrincipal principal = new ToeicUserPrincipal(
                "uid-1",
                "user@example.com",
                "Old name",
                null,
                UserRole.USER,
                1000L,
                2000L
        );
        UpdateUserProfileRequest request = new UpdateUserProfileRequest();
        request.setDisplayName("Minh Anh");
        request.setPhotoUrl("https://example.com/avatar.png");
        request.setTargetScore(800);
        request.setPhoneNumber("+84901234567");
        request.setDateOfBirth("2001-09-18");
        request.setGender("FEMALE");
        when(currentUserService.updateProfile(
                "uid-1",
                "Minh Anh",
                "https://example.com/avatar.png",
                800,
                "+84901234567",
                "2001-09-18",
                "FEMALE"
        )).thenReturn(Map.of("uid", "uid-1", "displayName", "Minh Anh"));

        Map<String, Object> response = controller.updateMe(request, principal);

        assertEquals("uid-1", response.get("uid"));
        assertEquals("Minh Anh", response.get("displayName"));
        verify(currentUserService).updateProfile(
                "uid-1",
                "Minh Anh",
                "https://example.com/avatar.png",
                800,
                "+84901234567",
                "2001-09-18",
                "FEMALE"
        );
    }
}
