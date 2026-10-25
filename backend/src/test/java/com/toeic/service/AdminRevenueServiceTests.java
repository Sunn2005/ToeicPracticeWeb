package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.enums.PaymentOrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class AdminRevenueServiceTests {
    private MemoryOrders dao;
    private AdminRevenueService service;

    @BeforeEach
    void setUp() {
        dao = new MemoryOrders();
        service = new AdminRevenueService(dao);
    }

    @Test
    void totalsAverageConversionAndPlanSplitCountOnlyPaidDatedOrders() throws Exception {
        dao.orders.addAll(List.of(
                order("PRO_30", PaymentOrderStatus.PAID, 100, 200L, 1000),
                order("PRO_30", PaymentOrderStatus.PAID, 100, 300L, 1001),
                order("PRO_1DAY", PaymentOrderStatus.PAID, 100, 400L, 200),
                order("PRO_30", PaymentOrderStatus.PENDING, 100, null, 9999),
                order("PRO_30", PaymentOrderStatus.CANCELLED, 100, 200L, 9999)));
        var report = service.getRevenue(null, null, null);
        assertEquals(2201, report.totalRevenue());
        assertEquals(3, report.paidOrderCount());
        assertEquals(5, report.totalOrderCount());
        assertEquals(0.6, report.successRate(), 0.00001);
        assertEquals(733, report.averageOrderValue());
        assertEquals(List.of(new AdminRevenueService.PlanRevenue("PRO_30", 2001, 2),
                new AdminRevenueService.PlanRevenue("PRO_1DAY", 200, 1)), report.byPlan());
        assertEquals(2201, report.series().stream().mapToLong(AdminRevenueService.RevenuePoint::revenue).sum());
    }

    @Test
    void emptyOrdersHaveZeroMetricsAndOnlyBoundedRangesAreZeroFilled() throws Exception {
        var empty = service.getRevenue(null, null, "day");
        assertEquals(0, empty.totalRevenue());
        assertEquals(0, empty.paidOrderCount());
        assertEquals(0, empty.totalOrderCount());
        assertEquals(0, empty.successRate());
        assertEquals(0, empty.averageOrderValue());
        assertTrue(empty.byPlan().isEmpty());
        assertTrue(empty.series().isEmpty());
        var bounded = service.getRevenue(epoch("2026-10-01T00:00:00+07:00"), epoch("2026-10-03T23:59:59+07:00"), "day");
        assertEquals(List.of("2026-10-01", "2026-10-02", "2026-10-03"), periods(bounded));
        assertTrue(bounded.series().stream().allMatch(point -> point.revenue() == 0 && point.orders() == 0));
        assertTrue(service.getRevenue(0L, null, "day").series().isEmpty());
    }

    @Test
    void filtersPaymentDateInclusivelyAndKeepsConversionCohortSeparate() throws Exception {
        dao.orders.addAll(List.of(
                order("PRO_30", PaymentOrderStatus.PAID, 50, 100L, 1000),
                order("PRO_30", PaymentOrderStatus.PAID, 50, 200L, 2000),
                order("PRO_30", PaymentOrderStatus.PAID, 150, 201L, 3000),
                order("PRO_30", PaymentOrderStatus.PENDING, 150, null, 9000)));
        var report = service.getRevenue(100L, 200L, "day");
        assertEquals(3000, report.totalRevenue());
        assertEquals(2, report.paidOrderCount());
        assertEquals(2, report.totalOrderCount());
        assertEquals(0.5, report.successRate());
        assertEquals(1000, service.getRevenue(null, 100L, "day").totalRevenue());
        assertEquals(5000, service.getRevenue(200L, null, "day").totalRevenue());
        var noCreated = service.getRevenue(200L, 200L, "day");
        assertEquals(1, noCreated.paidOrderCount());
        assertEquals(0, noCreated.totalOrderCount());
        assertEquals(0, noCreated.successRate());
    }

    @Test
    void neverSubstitutesCreationDateForMissingPaymentDate() throws Exception {
        dao.orders.add(order("PRO_30", PaymentOrderStatus.PAID, 100, null, 1000));
        var report = service.getRevenue(0L, 200L, "day");
        assertEquals(0, report.totalRevenue());
        assertEquals(0, report.paidOrderCount());
        assertEquals(0, report.averageOrderValue());
        assertTrue(report.byPlan().isEmpty());
        assertEquals(1, report.totalOrderCount());
        assertEquals(1, report.successRate());
        assertTrue(report.series().stream().allMatch(point -> point.revenue() == 0));
    }

    @Test
    void bucketsAtVietnamMidnightAndZeroFillsDaysInAscendingOrder() throws Exception {
        long from = epoch("2026-10-01T00:00:00+07:00");
        long to = epoch("2026-10-03T23:59:59.999+07:00");
        dao.orders.add(order("PRO_30", PaymentOrderStatus.PAID, 0, epoch("2026-10-02T17:00:00Z"), 300));
        dao.orders.add(order("PRO_30", PaymentOrderStatus.PAID, 0, epoch("2026-09-30T17:00:00Z"), 100));
        dao.orders.add(order("PRO_30", PaymentOrderStatus.PAID, 0, epoch("2026-09-30T16:59:59.999Z"), 900));
        var report = service.getRevenue(from, to, "day");
        assertEquals(List.of(new AdminRevenueService.RevenuePoint("2026-10-01", 100, 1),
                new AdminRevenueService.RevenuePoint("2026-10-02", 0, 0),
                new AdminRevenueService.RevenuePoint("2026-10-03", 300, 1)), report.series());
        assertEquals(List.of("2026-09-30", "2026-10-01", "2026-10-03"), periods(service.getRevenue(null, null, "day")));
    }

    @Test
    void monthlyBucketsHandleYearBoundaryAndZeroFill() throws Exception {
        dao.orders.add(order("PRO_30", PaymentOrderStatus.PAID, 0, epoch("2027-01-31T17:00:00Z"), 200));
        dao.orders.add(order("PRO_30", PaymentOrderStatus.PAID, 0, epoch("2026-12-01T00:00:00+07:00"), 100));
        var report = service.getRevenue(epoch("2026-12-01T00:00:00+07:00"), epoch("2027-02-28T23:59:59.999+07:00"), "month");
        assertEquals(List.of("2026-12", "2027-01", "2027-02"), periods(report));
        assertEquals(0, report.series().get(1).revenue());
        assertEquals(200, report.series().get(2).revenue());
    }

    @Test
    void invalidFiltersReturnStable400WithoutReadingOrMutatingData() {
        for (String unit : List.of("year", "DAY", "")) {
            assertFilterError(() -> service.getRevenue(null, null, unit));
        }
        assertFilterError(() -> service.getRevenue(200L, 100L, "day"));
        assertFilterError(() -> service.getRevenue(0L, Long.MAX_VALUE, "day"));
        assertEquals(0, dao.reads);
    }

    private void assertFilterError(org.junit.jupiter.api.function.Executable call) {
        var error = assertThrows(ApiCodeException.class, call);
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        assertEquals("PAYMENT_REVENUE_FILTER_INVALID", error.getCode());
    }

    private List<String> periods(AdminRevenueService.RevenueReport report) {
        return report.series().stream().map(AdminRevenueService.RevenuePoint::period).toList();
    }

    private long epoch(String date) { return java.time.OffsetDateTime.parse(date).toInstant().toEpochMilli(); }

    private PaymentOrder order(String plan, PaymentOrderStatus status, long created, Long paid, long amount) {
        PaymentOrder order = new PaymentOrder();
        order.setPlanCode(plan);
        order.setStatus(status);
        order.setCreatedAt(created);
        order.setPaidAt(paid);
        order.setAmount(amount);
        return order;
    }

    static class MemoryOrders implements PaymentOrderDao {
        final List<PaymentOrder> orders = new ArrayList<>();
        int reads;
        @Override public List<PaymentOrder> findAll() { reads++; return List.copyOf(orders); }
        @Override public void save(PaymentOrder order) { throw new AssertionError("Report must not write"); }
        @Override public Optional<PaymentOrder> findByOrderCode(long code) { throw new AssertionError("Unexpected lookup"); }
        @Override public Optional<PaymentOrder> findLatestPending(String uid, String plan) { throw new AssertionError("Unexpected lookup"); }
        @Override public boolean existsPaidOrder(String uid, String plan) { throw new AssertionError("Unexpected lookup"); }
        @Override public PaymentOrder updateAtomically(long code, Function<PaymentOrder, Mutation> mutation) { throw new AssertionError("Report must not write"); }
    }
}
