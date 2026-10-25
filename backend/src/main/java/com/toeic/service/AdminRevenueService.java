package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.enums.PaymentOrderStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class AdminRevenueService {
    private static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final long MAX_SERIES_BUCKETS = 3660;
    private final PaymentOrderDao paymentOrderDao;

    public AdminRevenueService(PaymentOrderDao paymentOrderDao) {
        this.paymentOrderDao = paymentOrderDao;
    }

    public record PlanRevenue(String planCode, long revenue, long orders) { }
    public record RevenuePoint(String period, long revenue, long orders) { }
    public record RevenueReport(long totalRevenue, long paidOrderCount, long totalOrderCount,
                                double successRate, long averageOrderValue,
                                List<PlanRevenue> byPlan, List<RevenuePoint> series) { }

    public RevenueReport getRevenue(Long from, Long to, String granularity) throws Exception {
        String unit = granularity == null ? "day" : granularity;
        if (!unit.equals("day") && !unit.equals("month")) {
            throw invalidFilter("Granularity must be day or month");
        }
        if (from != null && to != null && from > to) {
            throw invalidFilter("The end must be on or after the start");
        }
        Map<String, long[]> series = new TreeMap<>();
        if (from != null && to != null) {
            LocalDate first = bucketDate(from, unit);
            LocalDate last = bucketDate(to, unit);
            long count = (unit.equals("day") ? ChronoUnit.DAYS : ChronoUnit.MONTHS).between(first, last) + 1;
            if (count > MAX_SERIES_BUCKETS) {
                throw invalidFilter("Select a shorter range or monthly grouping (maximum 3660 periods)");
            }
            for (LocalDate date = first; !date.isAfter(last);
                 date = unit.equals("day") ? date.plusDays(1) : date.plusMonths(1)) {
                series.put(period(date, unit), new long[2]);
            }
        }

        long totalRevenue = 0;
        long paidOrderCount = 0;
        long createdOrderCount = 0;
        long paidCreatedOrderCount = 0;
        Map<String, long[]> plans = new HashMap<>();
        for (PaymentOrder order : paymentOrderDao.findAll()) {
            // Conversion is a separate cohort: orders created in the selected range, at their current status.
            if (inRange(order.getCreatedAt(), from, to)) {
                createdOrderCount++;
                if (order.getStatus() == PaymentOrderStatus.PAID) paidCreatedOrderCount++;
            }
            // Never invent a payment date for historical records that lack paidAt.
            if (order.getStatus() != PaymentOrderStatus.PAID || order.getPaidAt() == null
                    || !inRange(order.getPaidAt(), from, to)) continue;
            totalRevenue += order.getAmount();
            paidOrderCount++;
            add(plans.computeIfAbsent(order.getPlanCode(), ignored -> new long[2]), order.getAmount());
            String key = period(bucketDate(order.getPaidAt(), unit), unit);
            add(series.computeIfAbsent(key, ignored -> new long[2]), order.getAmount());
        }
        List<PlanRevenue> byPlan = plans.entrySet().stream()
                .map(entry -> new PlanRevenue(entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .sorted(Comparator.comparingLong(PlanRevenue::revenue).reversed()
                        .thenComparing(PlanRevenue::planCode, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<RevenuePoint> points = series.entrySet().stream()
                .map(entry -> new RevenuePoint(entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .toList();
        return new RevenueReport(totalRevenue, paidOrderCount, createdOrderCount,
                createdOrderCount == 0 ? 0 : (double) paidCreatedOrderCount / createdOrderCount,
                paidOrderCount == 0 ? 0 : totalRevenue / paidOrderCount, byPlan, points);
    }

    private static boolean inRange(long timestamp, Long from, Long to) {
        return (from == null || timestamp >= from) && (to == null || timestamp <= to);
    }

    private static LocalDate bucketDate(long timestamp, String unit) {
        LocalDate date = Instant.ofEpochMilli(timestamp).atZone(REPORT_ZONE).toLocalDate();
        return unit.equals("month") ? date.withDayOfMonth(1) : date;
    }

    private static String period(LocalDate date, String unit) {
        return unit.equals("month") ? java.time.YearMonth.from(date).toString() : date.toString();
    }

    private static void add(long[] totals, long amount) {
        totals[0] += amount;
        totals[1]++;
    }

    private static ApiCodeException invalidFilter(String message) {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "PAYMENT_REVENUE_FILTER_INVALID", message);
    }
}
