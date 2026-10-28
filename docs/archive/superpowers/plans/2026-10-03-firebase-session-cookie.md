# Firebase Session Cookie Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-persisted Firebase credentials and Bearer authentication with a seven-day HttpOnly Firebase session cookie, credentialed requests, and CSRF protection.

**Architecture:** The Firebase Web SDK performs only the interactive sign-in and hands a fresh ID token to a Spring endpoint. Spring verifies that token, creates the Firebase session cookie, and thereafter authenticates every protected request from that cookie while preserving the existing principal, Firestore role, and business APIs.

**Tech Stack:** Java 21, Spring Boot 4.1/Spring Security, Firebase Admin 9.10, React 19, Firebase Web SDK 12, Vite, Node test runner.

**Spec:** `docs/archive/superpowers/specs/2026-10-03-firebase-session-cookie-design.md`

## Global Constraints

- Preserve Firestore `users/{uid}.role` as the only authorization source.
- Preserve attempt ownership, exam deadlines, autosave, locking, scoring, submission, and AI workflows.
- Do not expose or log ID tokens, session cookies, service-account data, or private user data.
- Production API URL is `https://api.capytoeic.id.vn`; local API URL is `http://localhost:8080`.
- Session duration is fixed at seven days; production cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, host-only, and `Path=/`.
- Local HTTP development sets only the `Secure` attribute to false through `AUTH_COOKIE_SECURE=false`.
- CORS allows credentials only for explicit trusted origins/patterns and never uses `*`.
- No new or upgraded dependency is permitted.

## Review Focus

- A stale ID token with `auth_time` older than five minutes must not create a session.
- A missing, expired, invalid, or revoked session cookie must yield the existing JSON `401` contract without leaking token content.
- An unsafe request without a matching CSRF cookie/header pair must be rejected, while valid multipart requests must retain the browser-generated boundary.
- A network or backend failure during bootstrap/autosave must not be misclassified as logout; only `401` invalidates local authentication state.
- A session expiring during an exam must not erase in-memory answers or alter server-side attempt timing/submission behavior.

---

### Task 1: Backend session primitives and profile synchronization

**Files:**
- Create: `backend/src/main/java/com/toeic/config/AuthProperties.java`
- Create: `backend/src/main/java/com/toeic/service/FirebaseSessionService.java`
- Create: `backend/src/test/java/com/toeic/service/FirebaseSessionServiceTests.java`
- Modify: `backend/src/main/java/com/toeic/service/CurrentUserService.java`
- Modify: `backend/src/test/java/com/toeic/service/CurrentUserServiceTests.java`
- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/test/resources/application-test.properties`

**Interfaces:**
- Produces: `AuthProperties(cookieName, sessionDuration, cookieSecure, cookieSameSite)` bound from `app.auth.*`.
- Produces: `FirebaseSessionService.createSession(String idToken): SessionIdentity` and `verifySession(String cookie): FirebaseIdentity`.
- Produces: `CurrentUserService.requireUser(FirebaseIdentity identity): User`, preserving default-role and legacy-role repair behavior.

- [ ] **Step 1: Write failing service tests** for a fresh-token session, stale `auth_time`, invalid session verification, no client role trust, and existing/legacy Firestore profiles.
- [ ] **Step 2: Run targeted tests** with `cd backend && ./mvnw -Dtest=FirebaseSessionServiceTests,CurrentUserServiceTests test`; expect failures for missing interfaces.
- [ ] **Step 3: Implement the minimal properties, Firebase session service, and identity-based user synchronization** using Firebase Admin's session-cookie APIs and a five-minute recent-login check.
- [ ] **Step 4: Run the targeted tests again** and require all tests to pass.
- [ ] **Step 5: Commit** the backend session primitives and tests.

### Task 2: Cookie endpoints, session authentication filter, CSRF, and centralized CORS

**Files:**
- Create: `backend/src/main/java/com/toeic/controller/AuthenticationController.java`
- Create: `backend/src/main/java/com/toeic/dto/CreateSessionRequest.java`
- Create: `backend/src/test/java/com/toeic/controller/AuthenticationControllerTests.java`
- Modify: `backend/src/main/java/com/toeic/security/FirebaseAuthenticationFilter.java`
- Modify: `backend/src/main/java/com/toeic/config/SecurityConfig.java`
- Modify: `backend/src/test/java/com/toeic/security/SecurityAuthorizationTests.java`
- Modify: controller files currently containing `@CrossOrigin` under `backend/src/main/java/com/toeic/controller/`

**Interfaces:**
- Consumes: Task 1's `FirebaseSessionService`, `AuthProperties`, and `CurrentUserService.requireUser(FirebaseIdentity)`.
- Produces: `GET /api/v1/auth/csrf`, `POST /api/v1/auth/session`, and `POST /api/v1/auth/logout`.
- Produces: cookie-authenticated `ToeicAuthenticationToken` with the unchanged role authorities.

- [ ] **Step 1: Write failing MVC/security tests** asserting session cookie attributes, seven-day max age, profile response, logout clearing, CORS credentials, session-cookie authentication, revoked/invalid session `401`, CSRF rejection without a token, and CSRF acceptance with a valid token.
- [ ] **Step 2: Run targeted tests** with `cd backend && ./mvnw -Dtest=AuthenticationControllerTests,SecurityAuthorizationTests test`; expect failures for absent endpoints and cookie auth.
- [ ] **Step 3: Implement `AuthenticationController` and cookie construction** without returning credentials in JSON and without setting a `Domain` attribute.
- [ ] **Step 4: Replace Bearer parsing in `FirebaseAuthenticationFilter` with session-cookie verification** while preserving the current authentication entry point and business-error behavior.
- [ ] **Step 5: Enable Spring CSRF with `CookieCsrfTokenRepository`, expose the token endpoint, permit session creation/logout as designed, add `X-XSRF-TOKEN` to CORS, and remove duplicate controller CORS annotations.**
- [ ] **Step 6: Run the targeted tests again** and require all tests to pass.
- [ ] **Step 7: Commit** the backend HTTP/security boundary.

### Task 3: Credentialed frontend API and CSRF client

**Files:**
- Create: `frontend/src/api/auth.js`
- Create: `frontend/src/api/client.test.js`
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `getCsrfToken(): Promise<string>`, `createSession(idToken): Promise<Profile>`, `destroySession(): Promise<void>`, and `clearCsrfToken(): void`.
- Produces: `apiFetch(path, options)` and `publicApiFetch(path)` that always use `credentials: "include"`; unsafe requests add the in-memory CSRF token.
- Removes: `forceRefresh`, Firebase `auth.currentUser` lookup, `getIdToken`, and Authorization-header injection from the shared API client.

- [ ] **Step 1: Add failing Node tests** for credentialed GET, CSRF bootstrap/header on unsafe methods, CSRF token reuse/reset, FormData behavior, JSON error parsing, and `401` propagation.
- [ ] **Step 2: Add the new test file to `npm test` and run** `cd frontend && npm test`; expect the new tests to fail.
- [ ] **Step 3: Implement the auth API and refactor the shared client** with no browser-persistent credential storage.
- [ ] **Step 4: Run frontend tests** and require all client tests to pass.
- [ ] **Step 5: Commit** the credentialed API client.

### Task 4: Session-backed React authentication, login, and logout

**Files:**
- Modify: `frontend/src/firebase.js`
- Modify: `frontend/src/auth/AuthContext.jsx`
- Modify: `frontend/src/auth/useAuth.js`
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/pages/auth/LoginPage.jsx`
- Modify: `frontend/src/layouts/UserLayout.jsx`
- Modify: `frontend/src/layouts/ManagementLayout.jsx`
- Modify: `frontend/src/pages/errors/ForbiddenPage.jsx`
- Modify: `frontend/src/pages/Welcome.jsx`
- Modify: `frontend/src/App.test.js`
- Create: `frontend/src/auth/sessionState.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: Task 3's auth/session API.
- Produces: `AuthProvider` state sourced from `/api/me`, with `establishSession(firebaseUser)`, `logout()`, `refreshProfile()`, and `handleUnauthorized()`.
- Preserves: `user`, `profile`, `role`, `authLoading`, `profileLoading`, and `profileError` consumed by existing routes/layouts.

- [ ] **Step 1: Write failing Node tests with mocked API/Firebase boundaries plus source regression assertions** for startup `200`, startup `401`, startup network failure, successful Google/staff session exchange, logout, and role-based routing; do not add a UI-test dependency.
- [ ] **Step 2: Run the relevant frontend tests** and verify failures reflect the old Firebase-persistence flow.
- [ ] **Step 3: Change Firebase Auth to in-memory persistence** and exchange the temporary ID token before signing out the Firebase client.
- [ ] **Step 4: Refactor `AuthProvider` to bootstrap from `/api/me`** and preserve network errors separately from signed-out state.
- [ ] **Step 5: Route every login/logout action through the context session methods** and retain current destination/role checks.
- [ ] **Step 6: Run frontend tests** and require all auth-flow tests to pass.
- [ ] **Step 7: Commit** the React session lifecycle.

### Task 5: Remove remaining Bearer assumptions and update contracts

**Files:**
- Modify: `frontend/src/pages/PracticePart.jsx`
- Modify: `frontend/src/api/*.js` callers that still pass `forceRefresh`
- Modify: `frontend/src/api/client.js` fallback production URL
- Modify: `frontend/.env.example`
- Modify: `frontend/README.md`
- Modify: `docs/archive/API_ROLE_WORKFLOWS.md`

**Interfaces:**
- Consumes: Task 3's shared credentialed API client.
- Produces: no protected frontend request that manually reads Firebase tokens or sets `Authorization`.
- Documents: session creation, CSRF, logout, cookie attributes, local `AUTH_COOKIE_SECURE=false`, and `https://api.capytoeic.id.vn`.

- [ ] **Step 1: Add or update regression assertions** so repository searches and tests reject remaining protected-request Bearer logic and stale `forceRefresh` usage.
- [ ] **Step 2: Migrate `PracticePart.jsx` and all affected callers** to `apiFetch` without changing legacy route behavior.
- [ ] **Step 3: Update production URL/configuration and both API/frontend contracts** with the custom-domain rollout steps.
- [ ] **Step 4: Run `rg -n "getIdToken|Authorization:|Bearer |forceRefresh|toeicpracticeweb\\.onrender\\.com" frontend/src frontend/README.md docs/archive/API_ROLE_WORKFLOWS.md`** and confirm no obsolete authentication logic remains; any intentional historical text must be explicitly explained.
- [ ] **Step 5: Commit** the migration cleanup and documentation.

### Task 6: Full verification and security review

**Files:**
- Review: all files changed by Tasks 1–5

**Interfaces:**
- Produces: verified backend/frontend builds and a reviewed diff with no unrelated changes.

- [ ] **Step 1: Run backend verification** with `cd backend && ./mvnw test` and require zero failures.
- [ ] **Step 2: Run frontend verification** with `cd frontend && npm run lint && npm test && npm run build` and require zero failures.
- [ ] **Step 3: Review cookie headers and security behavior manually** for local HTTP (`Secure=false`) and production (`Secure=true`, host-only, `SameSite=Lax`, `Path=/`).
- [ ] **Step 4: Review `git diff`, `git status`, and credential-sensitive searches**; exclude the pre-existing `.DS_Store` change and confirm no secret/token was introduced.
- [ ] **Step 5: Perform a final code review** focused on CSRF bypass, role trust, session fixation, token logging, exam autosave/error handling, and production origin configuration.
- [ ] **Step 6: Commit any verified review fixes separately** and report the exact commands/results plus the remaining manual Render/Vercel rollout actions.
