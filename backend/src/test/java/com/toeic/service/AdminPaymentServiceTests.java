package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.dao.UserDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.User;
import com.toeic.model.enums.PaymentOrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminPaymentServiceTests {
    private PaymentOrderDao orders;
    private UserDao users;
    private AdminPaymentService service;

    @BeforeEach
    void setUp() throws Exception {
        orders = mock(PaymentOrderDao.class);
        users = mock(UserDao.class);
        service = new AdminPaymentService(orders, users);
        when(orders.findAll()).thenReturn(List.of(
                order(1, "a", "PRO_30", PaymentOrderStatus.PENDING, 100),
                order(2, "b", "PRO_1DAY", PaymentOrderStatus.PAID, 300),
                order(3, "a", "PRO_30", PaymentOrderStatus.CANCELLED, 200)));
    }

    @Test
    void filtersEachCriterionAndCombinesInclusiveDates() throws Exception {
        assertEquals(List.of(2L), ids(service.listOrders("PAID", null, null, null, null, 0, 20)));
        assertEquals(List.of(2L), ids(service.listOrders(null, "PRO_1DAY", null, null, null, 0, 20)));
        assertEquals(List.of(3L, 1L), ids(service.listOrders(null, null, "a", null, null, 0, 20)));
        assertEquals(List.of(2L, 3L), ids(service.listOrders(null, null, null, 200L, null, 0, 20)));
        assertEquals(List.of(3L, 1L), ids(service.listOrders(null, null, null, null, 200L, 0, 20)));
        assertEquals(List.of(3L), ids(service.listOrders("CANCELLED", "PRO_30", "a", 200L, 200L, 0, 20)));
        assertTrue(service.listOrders(null, null, null, 300L, 100L, 0, 20).items().isEmpty());
    }

    @Test
    void sortsAndPaginatesWithTotalsAndSafeBounds() throws Exception {
        var page = service.listOrders(null, null, null, null, null, 1, 2);
        assertEquals(List.of(1L), ids(page));
        assertEquals(3, page.totalItems());
        assertEquals(2, page.totalPages());
        assertEquals(1, page.page());
        assertEquals(2, page.size());
        assertEquals(List.of(2L, 3L, 1L), ids(service.listOrders("", "", "", null, null, -5, 200)));
        assertEquals(100, service.listOrders(null, null, null, null, null, 0, 200).size());
        assertEquals(1, service.listOrders(null, null, null, null, null, -1, 0).size());
        assertEquals(1, service.listOrders(null, null, null, null, null, 0, -4).size());
        assertTrue(service.listOrders(null, null, null, null, null, Integer.MAX_VALUE, 100).items().isEmpty());
        when(orders.findAll()).thenReturn(List.of());
        var empty = service.listOrders(null, null, null, null, null, 0, 20);
        assertEquals(0, empty.totalItems());
        assertEquals(0, empty.totalPages());
    }

    @Test
    void enrichesDistinctBuyersOnlyOnTheRequestedPageAndToleratesMissingUsers() throws Exception {
        User buyer = new User();
        buyer.setEmail("buyer@example.com");
        buyer.setDisplayName("Buyer");
        when(users.findByUid("a")).thenReturn(Optional.of(buyer));
        var page = service.listOrders(null, null, null, null, null, 0, 20);
        assertNull(page.items().getFirst().buyerEmail());
        assertEquals("Buyer", page.items().get(1).buyerName());
        assertEquals("buyer@example.com", page.items().get(2).buyerEmail());
        verify(users, times(1)).findByUid("a");
        verify(users, times(1)).findByUid("b");
        clearInvocations(users);
        service.listOrders(null, null, null, null, null, 0, 1);
        verify(users).findByUid("b");
        verify(users, never()).findByUid("a");
    }

    @Test
    void failedBuyerLookupDoesNotHideOrdersAndIsNotRetriedForDuplicateUid() throws Exception {
        when(users.findByUid("a")).thenThrow(new Exception("User store unavailable"));
        var page = service.listOrders(null, null, null, null, null, 0, 20);
        assertEquals(3, page.items().size());
        assertNull(page.items().get(1).buyerName());
        verify(users, times(1)).findByUid("a");
    }

    @Test
    void invalidStatusReturnsStable400BeforeReadingOrders() {
        var error = assertThrows(ApiCodeException.class, () -> service.listOrders("INVALID", null, null, null, null, 0, 20));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        assertEquals("PAYMENT_ORDER_FILTER_INVALID", error.getCode());
        verifyNoInteractions(orders, users);
    }

    @Test
    void getsDetailAndReturnsStable404ForMissingOrder() throws Exception {
        PaymentOrder order = order(2, "b", "PRO_1DAY", PaymentOrderStatus.PAID, 300);
        order.setPaymentLinkId("link-2");
        order.setPaidAt(400L);
        order.setProExpiresAt(500L);
        when(orders.findByOrderCode(2)).thenReturn(Optional.of(order));
        var view = service.getOrder(2);
        assertEquals("link-2", view.paymentLinkId());
        assertEquals(400L, view.paidAt());
        assertEquals(500L, view.proExpiresAt());
        assertNull(view.buyerName());
        var error = assertThrows(ApiCodeException.class, () -> service.getOrder(404));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatus());
        assertEquals("PAYMENT_ORDER_NOT_FOUND", error.getCode());
    }

    private List<Long> ids(AdminPaymentService.AdminOrderPage page) {
        return page.items().stream().map(AdminPaymentService.AdminOrderView::orderCode).toList();
    }

    private PaymentOrder order(long code, String uid, String plan, PaymentOrderStatus status, long created) {
        PaymentOrder order = new PaymentOrder();
        order.setOrderCode(code);
        order.setUserId(uid);
        order.setPlanCode(plan);
        order.setStatus(status);
        order.setCreatedAt(created);
        order.setAmount(1000);
        order.setDurationDays(1);
        order.setCheckoutUrl("https://example.com/live-checkout");
        return order;
    }
}
