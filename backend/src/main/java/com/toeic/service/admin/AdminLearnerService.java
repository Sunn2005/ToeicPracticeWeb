package com.toeic.service.admin;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.toeic.dao.firestore.FirestoreAdminLearnerReader;
import com.toeic.dao.firestore.FirestoreAdminLearnerReader.CompletedAttempt;
import com.toeic.exception.ApiCodeException;
import com.toeic.model.billing.PaymentOrder;
import com.toeic.model.billing.Subscription;
import com.toeic.model.billing.enums.PaymentOrderStatus;
import com.toeic.model.user.User;
import com.toeic.service.billing.SubscriptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Callable;

@Service
public class AdminLearnerService {
    private static final Logger log = LoggerFactory.getLogger(AdminLearnerService.class);
    private static final int SCAN_LIMIT = 200;
    private static final int BATCH_SIZE = 25;

    private final FirestoreAdminLearnerReader reader;
    private final ObjectMapper mapper;

    public AdminLearnerService(FirestoreAdminLearnerReader reader, ObjectMapper mapper) {
        this.reader = reader;
        this.mapper = mapper;
    }

    public record Page<T>(List<T> items, String nextCursor) {}

    public enum ProStatus { PRO, FREE, UNKNOWN }
    public enum ProFilter { ALL, PRO, FREE }

    public record Learner(String uid, String displayName, String email, String photoUrl,
                          Integer targetScore, Long createdAt, Long lastLoginAt,
                          Long proExpiresAt, ProStatus proStatus) {}

    public record Detail(@JsonUnwrapped Learner learner, Statistics statistics) {}

    public record Statistics(int completedExamAttempts, int completedPracticeAttempts,
                             Long bestListeningScore, Long bestReadingScore, Long lastStudyAt) {}

    public record Order(long orderCode, String planCode, long amount, int durationDays,
                        PaymentOrderStatus status, long createdAt, Long paidAt) {
        private Order(PaymentOrder order) {
            this(order.getOrderCode(), order.getPlanCode(), order.getAmount(), order.getDurationDays(),
                    order.getStatus(), order.getCreatedAt(), order.getPaidAt());
        }
    }

    record ListCursor(String search, ProFilter pro, int size, String afterUid) {}
    record OrderCursor(String uid, int size, long createdAt, long orderCode) {}

    public Page<Learner> list(String search, String requestedPro, String requestedSize, String cursor) {
        int size = size(requestedSize);
        String needle = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        if (needle.codePointCount(0, needle.length()) > 100) {
            throw invalidQuery();
        }
        ProFilter pro;
        try {
            pro = ProFilter.valueOf(requestedPro);
        } catch (IllegalArgumentException exception) {
            throw invalidQuery();
        }
        String afterUid = null;
        if (cursor != null) {
            ListCursor position = decode(cursor, ListCursor.class);
            if (!needle.equals(position.search()) || pro != position.pro() || size != position.size()
                    || !validUid(position.afterUid())) {
                throw invalidQuery();
            }
            afterUid = position.afterUid();
        }

        long now = System.currentTimeMillis();
        List<Learner> items = new ArrayList<>(size);
        for (int read = 0; read < SCAN_LIMIT;) {
            String start = afterUid;
            int limit = Math.min(BATCH_SIZE, SCAN_LIMIT - read);
            List<User> batch = readData(() -> reader.usersAfter(start, limit));
            read += batch.size();
            List<User> candidates = batch.stream().filter(user -> matches(user, needle)).toList();
            Map<String, Subscription> subscriptions = subscriptions(
                    candidates.stream().map(User::getUid).toList(), pro != ProFilter.ALL);
            for (int index = 0; index < batch.size(); index++) {
                User user = batch.get(index);
                afterUid = user.getUid();
                if (matches(user, needle)) {
                    Learner learner = view(user, subscriptions, now);
                    if (pro == ProFilter.ALL || pro.name().equals(learner.proStatus().name())) {
                        items.add(learner);
                    }
                }
                if (items.size() == size) {
                    boolean mayHaveMore = index + 1 < batch.size() || batch.size() == limit;
                    return new Page<>(items, mayHaveMore ? encode(new ListCursor(needle, pro, size, afterUid)) : null);
                }
            }
            if (batch.size() < limit) {
                return new Page<>(items, null);
            }
        }
        return new Page<>(items, encode(new ListCursor(needle, pro, size, afterUid)));
    }

    public Detail detail(String uid) {
        User user = requireLearner(uid);
        long now = System.currentTimeMillis();
        return new Detail(view(user, subscriptions(List.of(uid), false), now),
                summarize(readData(() -> reader.completedAttempts(uid))));
    }

    public Page<Order> orders(String uid, String requestedSize, String cursor) {
        requireLearner(uid);
        int size = size(requestedSize);
        OrderCursor position = cursor == null ? null : decode(cursor, OrderCursor.class);
        if (position != null && (!uid.equals(position.uid()) || position.size() != size
                || position.createdAt() < 0 || position.orderCode() <= 0)) {
            throw invalidQuery();
        }
        List<PaymentOrder> orders = readData(() -> reader.orders(uid,
                position == null ? null : position.createdAt(),
                position == null ? null : position.orderCode(), size + 1));
        List<Order> items = orders.stream().limit(size).map(Order::new).toList();
        if (orders.size() <= size) {
            return new Page<>(items, null);
        }
        Order last = items.getLast();
        return new Page<>(items, encode(new OrderCursor(uid, size, last.createdAt(), last.orderCode())));
    }

    static Statistics summarize(List<CompletedAttempt> attempts) {
        int exams = 0;
        int practice = 0;
        Long listening = null;
        Long reading = null;
        Long lastStudy = null;
        for (CompletedAttempt attempt : attempts) {
            lastStudy = latest(lastStudy, attempt.submittedAt());
            if ("PRACTICE".equals(attempt.type())) {
                practice++;
                continue;
            }
            exams++;
            if (attempt.listeningQuestions() != null && attempt.listeningQuestions() > 0) {
                listening = latest(listening, attempt.listeningScore());
            }
            if (attempt.readingQuestions() != null && attempt.readingQuestions() > 0) {
                reading = latest(reading, attempt.readingScore());
            }
        }
        return new Statistics(exams, practice, listening, reading, lastStudy);
    }

    private static Long latest(Long previous, Long value) {
        if (value == null || (previous != null && previous >= value)) {
            return previous;
        }
        return value;
    }

    private User requireLearner(String uid) {
        if (!validUid(uid)) {
            throw notFound();
        }
        return readData(() -> reader.learner(uid)).orElseThrow(AdminLearnerService::notFound);
    }

    private Map<String, Subscription> subscriptions(List<String> uids, boolean required) {
        try {
            return reader.subscriptions(uids);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw unavailable("LEARNER_DATA_UNAVAILABLE");
        } catch (Exception exception) {
            if (required) {
                throw unavailable("LEARNER_SUBSCRIPTIONS_UNAVAILABLE");
            }
            return null;
        }
    }

    private static Learner view(User user, Map<String, Subscription> subscriptions, long now) {
        Subscription subscription = subscriptions == null ? null : subscriptions.get(user.getUid());
        boolean effective = SubscriptionService.isEffective(subscription, now);
        ProStatus status = subscriptions == null ? ProStatus.UNKNOWN : effective ? ProStatus.PRO : ProStatus.FREE;
        return new Learner(user.getUid(), user.getDisplayName(), user.getEmail(), user.getPhotoUrl(),
                user.getTargetScore(), user.getCreatedAt(), user.getLastLoginAt(),
                effective ? subscription.getExpiresAt() : null, status);
    }

    private static boolean matches(User user, String needle) {
        return needle.isEmpty() || contains(user.getDisplayName(), needle) || contains(user.getEmail(), needle);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static boolean validUid(String uid) {
        return uid != null && !uid.isBlank() && uid.length() <= 128 && !uid.contains("/")
                && !".".equals(uid) && !"..".equals(uid) && !(uid.startsWith("__") && uid.endsWith("__"));
    }

    private static int size(String requestedSize) {
        try {
            int size = Integer.parseInt(requestedSize);
            if (size >= 1 && size <= 50) {
                return size;
            }
        } catch (NumberFormatException ignored) {
            // Use the same error code for all invalid page sizes.
        }
        throw invalidQuery();
    }

    private String encode(Object cursor) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mapper.writeValueAsBytes(cursor));
    }

    private <T> T decode(String cursor, Class<T> type) {
        if (cursor.length() > 4096) {
            throw invalidQuery();
        }
        try {
            return Objects.requireNonNull(mapper.readValue(Base64.getUrlDecoder().decode(cursor), type));
        } catch (RuntimeException exception) {
            throw invalidQuery();
        }
    }

    private static <T> T readData(Callable<T> lookup) {
        try {
            return lookup.call();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw unavailable("LEARNER_DATA_UNAVAILABLE");
        } catch (Exception exception) {
            // Log only the exception type and Firestore status: never the message, which may echo query values.
            log.warn("Admin learner data read failed: {}{}", exception.getClass().getName(), causeSummary(exception));
            throw unavailable("LEARNER_DATA_UNAVAILABLE");
        }
    }

    private static String causeSummary(Throwable exception) {
        Throwable cause = exception.getCause();
        if (cause instanceof com.google.api.gax.rpc.ApiException api) {
            return " cause=" + api.getClass().getSimpleName() + " code=" + api.getStatusCode().getCode();
        }
        return cause == null ? "" : " cause=" + cause.getClass().getName();
    }

    private static ApiCodeException invalidQuery() {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "LEARNER_QUERY_INVALID", "Bộ lọc hoặc phân trang không hợp lệ");
    }

    private static ApiCodeException notFound() {
        return new ApiCodeException(HttpStatus.NOT_FOUND, "LEARNER_NOT_FOUND", "Không tìm thấy học viên");
    }

    private static ApiCodeException unavailable(String code) {
        return new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE, code, "Tạm thời không thể tải dữ liệu học viên");
    }
}
