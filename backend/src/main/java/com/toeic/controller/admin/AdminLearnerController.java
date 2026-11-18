package com.toeic.controller.admin;

import com.toeic.service.admin.AdminLearnerService;
import com.toeic.service.admin.AdminLearnerService.Detail;
import com.toeic.service.admin.AdminLearnerService.Learner;
import com.toeic.service.admin.AdminLearnerService.Order;
import com.toeic.service.admin.AdminLearnerService.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminLearnerController {
    private final AdminLearnerService service;

    public AdminLearnerController(AdminLearnerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<Page<Learner>> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "ALL") String pro,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(required = false) String cursor) {
        return noStore(service.list(search, pro, size, cursor));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<Detail> detail(@PathVariable String uid) {
        return noStore(service.detail(uid));
    }

    @GetMapping("/{uid}/orders")
    public ResponseEntity<Page<Order>> orders(@PathVariable String uid,
                                              @RequestParam(defaultValue = "20") String size,
                                              @RequestParam(required = false) String cursor) {
        return noStore(service.orders(uid, size, cursor));
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
