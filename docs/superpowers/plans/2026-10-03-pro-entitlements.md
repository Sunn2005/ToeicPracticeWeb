# Pro Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-owned Pro subscriptions, manual admin management, and Pro enforcement for AI Analysis.

**Architecture:** Keep role authorization unchanged and add a separate Firestore-backed subscription service that derives effective entitlements from server time. Expose a Pro summary through `/api/me`, provide admin-only subscription operations, and require `AI_ANALYSIS` only when creating or refreshing analysis while preserving reads of completed results.

**Tech Stack:** Java 21, Spring Boot 4.1, Spring Security, Firebase Admin/Firestore, React 19, React Router, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-pro-ai-chat-design.md`

## Global Constraints

- `users/{uid}.role` remains the sole role source; never introduce a `PRO` role.
- Pro grants exactly `AI_CHAT` and `AI_ANALYSIS`.
- Effective access requires `ACTIVE` and `startsAt <= serverNow < expiresAt`.
- Subscription mutation is backend-only and admin-only.
- Existing completed AI Analysis results remain readable after Pro expiry.
- No payment-provider concepts or new dependencies.
- Add every frontend translation key in English and Vietnamese.

## Review Focus

- A subscription with stored `ACTIVE` but an expired `expiresAt` must deny access; pin in `SubscriptionServiceTests`.
- Repeating an admin PUT with the same expiry must be idempotent and must not change `createdAt`; pin in `SubscriptionServiceTests`.
- A non-admin calling subscription management must receive `403`; pin in `SecurityAuthorizationTests`.
- A non-Pro analysis request must not mutate the attempt or publish RabbitMQ work; pin in `AIReviewServiceTests`.
- An expired user must still read a previously completed analysis; pin in `AIReviewServiceTests`.

---

### Task 1: Stable Domain Error Codes

**Files:**
- Create: `backend/src/main/java/com/toeic/controller/ApiCodeException.java`
- Modify: `backend/src/main/java/com/toeic/controller/ApiExceptionHandler.java`
- Test: `backend/src/test/java/com/toeic/controller/ApiExceptionHandlerTests.java`

**Interfaces:**
- Produces: `ApiCodeException(HttpStatus status, String code, String message)` with accessors used by `ApiExceptionHandler`.

- [ ] **Step 1: Write failing handler tests** asserting an `ApiCodeException(FORBIDDEN, "PRO_REQUIRED", ...)` renders HTTP 403 and body code `PRO_REQUIRED`, while existing `ResponseStatusException` behavior remains unchanged.
- [ ] **Step 2: Run the focused test** with `cd backend && ./mvnw -Dtest=ApiExceptionHandlerTests test`; expect failure because `ApiCodeException` does not exist.
- [ ] **Step 3: Implement the exception and a dedicated handler** without changing validation or unreadable-body handlers.
- [ ] **Step 4: Re-run the focused test**; expect PASS.
- [ ] **Step 5: Commit** `backend/src/main/java/com/toeic/controller/ApiCodeException.java`, `ApiExceptionHandler.java`, and the test with message `feat: support stable API error codes`.

### Task 2: Subscription Persistence and Effective Entitlements

**Files:**
- Create: `backend/src/main/java/com/toeic/model/Subscription.java`
- Create: `backend/src/main/java/com/toeic/model/enums/SubscriptionStatus.java`
- Create: `backend/src/main/java/com/toeic/model/enums/Entitlement.java`
- Create: `backend/src/main/java/com/toeic/dao/SubscriptionDao.java`
- Create: `backend/src/main/java/com/toeic/dao/firestore/FirestoreSubscriptionDao.java`
- Create: `backend/src/main/java/com/toeic/service/SubscriptionService.java`
- Test: `backend/src/test/java/com/toeic/service/SubscriptionServiceTests.java`
- Test: `backend/src/test/java/com/toeic/dao/firestore/FirestoreSubscriptionDaoTests.java`

**Interfaces:**
- Produces: `Optional<Subscription> SubscriptionDao.findByUserId(String userId)` and `void save(Subscription subscription)`.
- Produces: `SubscriptionSummary SubscriptionService.getSummary(String userId)`, `boolean hasEntitlement(String userId, Entitlement entitlement)`, `void requireEntitlement(String userId, Entitlement entitlement)`, `SubscriptionSummary activateOrExtend(String userId, long expiresAt, String adminUid)`, and `SubscriptionSummary revoke(String userId, String adminUid)`.
- Produces: nested or top-level immutable `SubscriptionSummary(status, startsAt, expiresAt, entitlements, effective)` serialized for controllers.

- [ ] **Step 1: Write failing service tests** for absent, active, future-start, expired-active, revoked, same-expiry idempotency, extension, reactivation, and immediate revocation using an injected `Clock` fixed to an exact instant.
- [ ] **Step 2: Run** `cd backend && ./mvnw -Dtest=SubscriptionServiceTests test`; expect compile failure for missing types.
- [ ] **Step 3: Implement model, enums, DAO interface, and service** with plan code `PRO`, exactly two entitlements, server-time checks, original `createdAt` preservation, and same-expiry idempotency.
- [ ] **Step 4: Re-run the service test**; expect PASS.
- [ ] **Step 5: Write failing Firestore DAO mapping tests** for collection `subscriptions`, document ID equal to UID, and restoration of missing legacy `userId` from document ID.
- [ ] **Step 6: Implement `FirestoreSubscriptionDao`** using full-document writes for this server-owned aggregate.
- [ ] **Step 7: Run both focused test classes**; expect PASS.
- [ ] **Step 8: Commit** the subscription model, DAO, service, and tests with message `feat: add Pro subscription entitlements`.

### Task 3: Admin Subscription API

**Files:**
- Create: `backend/src/main/java/com/toeic/dto/UpsertSubscriptionRequest.java`
- Create: `backend/src/main/java/com/toeic/controller/AdminSubscriptionController.java`
- Test: `backend/src/test/java/com/toeic/controller/AdminSubscriptionControllerTests.java`
- Modify: `backend/src/test/java/com/toeic/security/SecurityAuthorizationTests.java`

**Interfaces:**
- Consumes: `SubscriptionService.getSummary`, `activateOrExtend`, and `revoke` from Task 2.
- Produces: `GET /api/admin/subscriptions/{uid}`, `PUT /api/admin/subscriptions/{uid}` with `{ "expiresAt": <epochMillis> }`, and `DELETE /api/admin/subscriptions/{uid}`.

- [ ] **Step 1: Write failing controller tests** asserting principal UID is used as `adminUid`, PUT passes the target UID and exact expiry, DELETE revokes, and a past expiry yields `400 SUBSCRIPTION_EXPIRY_INVALID`.
- [ ] **Step 2: Run** `cd backend && ./mvnw -Dtest=AdminSubscriptionControllerTests test`; expect compile failure.
- [ ] **Step 3: Implement request DTO and controller** with class-level `@PreAuthorize("hasRole('ADMIN')")`; never accept status, entitlements, or audit actors from the body.
- [ ] **Step 4: Add security tests** proving ADMIN access and USER/EMPLOYEE denial for `/api/admin/subscriptions/**`.
- [ ] **Step 5: Run controller and security tests**; expect PASS.
- [ ] **Step 6: Commit** with message `feat: add admin Pro subscription API`.

### Task 4: Expose Derived Pro State Through `/api/me`

**Files:**
- Modify: `backend/src/main/java/com/toeic/service/CurrentUserService.java`
- Modify: `backend/src/test/java/com/toeic/service/CurrentUserServiceTests.java`
- Modify: `frontend/src/auth/AuthContext.jsx`
- Modify: `frontend/src/auth/sessionState.test.js`

**Interfaces:**
- Consumes: `SubscriptionService.getSummary(String userId)`.
- Produces: `/api/me` field `subscription` with `planCode`, `status`, `startsAt`, `expiresAt`, `entitlements`, and `effective`; frontend context field `entitlements: Set<string>` is not required—components consume `profile.subscription.entitlements` plus `effective` directly.

- [ ] **Step 1: Extend failing backend tests** to assert `/api/me` includes a derived inactive summary for no subscription and the exact active summary for Pro.
- [ ] **Step 2: Run** `cd backend && ./mvnw -Dtest=CurrentUserServiceTests test`; expect assertion/constructor failure.
- [ ] **Step 3: Inject `SubscriptionService` and add the summary** without storing subscription fields on `User`.
- [ ] **Step 4: Re-run backend tests**; expect PASS.
- [ ] **Step 5: Extend frontend session tests** to ensure the subscription object survives session load and is cleared on unauthorized logout.
- [ ] **Step 6: Make the minimal AuthContext changes** needed to expose the profile unchanged; do not create a second authority source.
- [ ] **Step 7: Run** `cd frontend && npm test`; expect PASS.
- [ ] **Step 8: Commit** with message `feat: expose Pro entitlements in user profile`.

### Task 5: Gate AI Analysis Creation and Refresh

**Files:**
- Modify: `backend/src/main/java/com/toeic/service/AIReviewService.java`
- Modify: `backend/src/test/java/com/toeic/service/AIReviewServiceTests.java`

**Interfaces:**
- Consumes: `SubscriptionService.requireEntitlement(userId, Entitlement.AI_ANALYSIS)`.
- Preserves: `AIReviewService.getAnalysis` remains readable based on ownership and completion state without a Pro check.

- [ ] **Step 1: Add failing tests** for non-Pro create, non-Pro refresh, entitled create, no mutation/publish on denial, and expired user reading a completed result.
- [ ] **Step 2: Run** `cd backend && ./mvnw -Dtest=AIReviewServiceTests test`; expect failures because entitlement is not enforced.
- [ ] **Step 3: Inject `SubscriptionService` and require `AI_ANALYSIS`** before any analysis state mutation in both normal and refresh paths; leave `getAnalysis` unchanged.
- [ ] **Step 4: Update affected constructor setup** in existing controller/context tests without weakening assertions.
- [ ] **Step 5: Run** `cd backend && ./mvnw test`; expect PASS.
- [ ] **Step 6: Commit** with message `feat: require Pro for AI analysis requests`.

### Task 6: Admin Pro Management UI

**Files:**
- Create: `frontend/src/api/adminSubscriptions.js`
- Create: `frontend/src/api/adminSubscriptions.test.js`
- Create: `frontend/src/pages/admin/SubscriptionManagementPage.jsx`
- Modify: `frontend/src/layouts/ManagementLayout.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/i18n/translations.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: Task 3 endpoints through `getSubscription(uid)`, `upsertSubscription(uid, expiresAt)`, and `revokeSubscription(uid)`.
- Produces: ADMIN-only route `/console/subscriptions` with UID lookup, 30-day default expiry, explicit expiry editing, activation/extension, and revoke confirmation.

- [ ] **Step 1: Write failing API wrapper tests** asserting encoded UID paths, JSON body shape, and DELETE behavior; add the test file to the explicit `npm test` script.
- [ ] **Step 2: Run** `cd frontend && npm test`; expect failure because the module is missing.
- [ ] **Step 3: Implement the API wrapper** using `apiFetch` only.
- [ ] **Step 4: Re-run API tests**; expect PASS.
- [ ] **Step 5: Implement the page** with loading, empty, success, error, expiry validation, disabled double-submit, and revoke confirmation states.
- [ ] **Step 6: Add the ADMIN-only route and navigation item** without changing existing `/full-test/**` routes; add all EN/VI keys together.
- [ ] **Step 7: Run** `cd frontend && npm run lint && npm test && npm run build`; expect all PASS.
- [ ] **Step 8: Commit** with message `feat: add admin Pro subscription management`.

### Task 7: Contract Documentation and Phase Verification

**Files:**
- Modify: `docs/API_ROLE_WORKFLOWS.md`
- Modify: `docs/TEAM_FRONTEND_ASSIGNMENTS.md`

**Interfaces:**
- Documents: subscription schema, effective-entitlement rule, `/api/me` summary, admin endpoints, AI Analysis `PRO_REQUIRED`, and ownership of new frontend files.

- [ ] **Step 1: Update API contracts** with exact paths, methods, bodies, responses, status codes, and stable error codes implemented above.
- [ ] **Step 2: Update frontend ownership rules** for subscription API/page and shared route/navigation edits.
- [ ] **Step 3: Run** `cd backend && ./mvnw test` and `cd frontend && npm run lint && npm test && npm run build`; expect all PASS.
- [ ] **Step 4: Review** `git diff --check`, `git status --short`, and the scoped diff; confirm unrelated `.DS_Store` is untouched.
- [ ] **Step 5: Commit** with message `docs: document Pro subscription contracts`.

