package com.toeic.controller;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.StaffManagementService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/admin/staff")
@PreAuthorize("hasRole('ADMIN')")
public class StaffManagementController {
    private final StaffManagementService service;
    private final com.toeic.service.StaffCredentialService credentials;
    public StaffManagementController(StaffManagementService service, com.toeic.service.StaffCredentialService credentials) { this.service = service; this.credentials = credentials; }
    @GetMapping public StaffManagementService.Directory directory() throws Exception { return service.directory(); }
    @GetMapping("/lookup") public StaffManagementService.Member lookup(@RequestParam String email) throws Exception { return service.lookup(email); }
    @PostMapping("/groups") @ResponseStatus(HttpStatus.CREATED)
    public Object createGroup(@AuthenticationPrincipal ToeicUserPrincipal actor, @RequestBody StaffManagementService.GroupRequest body) throws Exception { return service.saveGroup(actor.uid(), null, body); }
    @PutMapping("/groups/{id}")
    public Object updateGroup(@AuthenticationPrincipal ToeicUserPrincipal actor, @PathVariable String id, @RequestBody StaffManagementService.GroupRequest body) throws Exception { return service.saveGroup(actor.uid(), id, body); }
    @DeleteMapping("/groups/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(@AuthenticationPrincipal ToeicUserPrincipal actor, @PathVariable String id, @RequestParam Long version) throws Exception { service.deleteGroup(actor.uid(), id, version); }
    @PostMapping("/members") @ResponseStatus(HttpStatus.CREATED)
    public Object addMember(@AuthenticationPrincipal ToeicUserPrincipal actor, @RequestBody com.toeic.service.StaffCredentialService.CreateRequest body) throws Exception { return credentials.create(actor.uid(), body); }
    @PostMapping("/members/{uid}/credentials/resend")
    public Object resend(@AuthenticationPrincipal ToeicUserPrincipal actor, @PathVariable String uid) throws Exception { return credentials.resend(actor.uid(), uid); }
    @PutMapping("/members/{uid}")
    public Object updateMember(@AuthenticationPrincipal ToeicUserPrincipal actor, @PathVariable String uid, @RequestBody StaffManagementService.MemberRequest body) throws Exception { return service.saveMember(actor.uid(), uid, body, false); }
    @DeleteMapping("/members/{uid}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMember(@AuthenticationPrincipal ToeicUserPrincipal actor, @PathVariable String uid, @RequestParam Long version) throws Exception { service.deleteMember(actor.uid(), uid, version); }
}
