# CSRF and Chat Attempt Guard Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover safely from stale CSRF state so attempts can be saved/submitted, while keeping Capy AI Chat unavailable during a genuinely active attempt and guiding the learner back to their attempt history.

**Architecture:** Keep CSRF handling centralized in the existing frontend API client. An unsafe request retries exactly once only when the backend returns `403 CSRF_TOKEN_INVALID`, after clearing the cached token and obtaining a fresh one; authentication success also invalidates the pre-authentication token cache. Existing server-side attempt reconciliation and completed-only chat context filtering remain authoritative and unchanged.

**Tech Stack:** React 19, browser Fetch API, Node test runner, Spring Boot/JUnit verification.

**Spec:** `docs/archive/superpowers/specs/2026-10-03-pro-ai-chat-design.md`

## Global Constraints

- Do not weaken server-side ownership, authentication, subscription, exam locking, or attempt-state checks.
- Never expose correct answers, explanations, translations, or transcripts for an `IN_PROGRESS` attempt.
- Retry an unsafe request at most once and only for structured backend code `CSRF_TOKEN_INVALID`.
- Preserve `FormData`, `AbortSignal`, HTTP method, body, headers, credentials, and structured `ApiError` behavior across the retry.
- Do not add or upgrade dependencies.
- Add every new UI translation key in English and Vietnamese.

## Review Focus

- A stale CSRF token followed by a successful refresh retries the original mutation once and returns its result.
- A second CSRF rejection is returned to the caller without an infinite retry loop.
- Non-CSRF `401`/`403` responses are never retried.
- Successful login invalidates the CSRF token obtained before the session boundary.
- Multipart request headers and caller-provided abort signals survive a CSRF retry unchanged.

---

### Task 1: Centralized CSRF Recovery

**Files:**
- Modify: `frontend/src/api/client.test.js`
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/api/auth.js`

**Interfaces:**
- Consumes: Existing `apiFetch(path, options)`, `publicApiFetch(path, options)`, `getCsrfToken()`, `clearCsrfToken()`, and structured `ApiError.body.code`.
- Produces: Unsafe API requests that transparently recover once from `403 CSRF_TOKEN_INVALID`; `createSession(idToken)` that clears cached CSRF state after successful session creation.

- [ ] **Step 1: Write failing CSRF recovery tests**

Add tests named:

- `unsafe request refreshes CSRF and retries once after CSRF_TOKEN_INVALID`
- `a repeated CSRF_TOKEN_INVALID response is propagated after one retry`
- `non-CSRF forbidden responses are not retried`
- `CSRF retry preserves FormData boundary ownership and AbortSignal`
- `successful session creation clears the pre-authentication CSRF token`

Assert the exact fetch order, token header values, call count, original body/signal identity, and final result/error.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd frontend && node --test src/api/client.test.js`

Expected: New recovery/session-boundary tests fail because the client currently propagates the first CSRF error and retains the pre-authentication token.

- [ ] **Step 3: Implement one-shot recovery in the shared client**

Refactor the internal request execution so an unsafe request receiving status `403` and body code `CSRF_TOKEN_INVALID` calls `clearCsrfToken()`, obtains a new token, and repeats the same request exactly once. The retry path must never recurse indefinitely and must preserve caller options.

Update `createSession(idToken)` to clear cached CSRF state only after the session request succeeds.

- [ ] **Step 4: Run focused and full frontend tests**

Run: `cd frontend && node --test src/api/client.test.js`

Expected: All client tests pass.

Run: `cd frontend && npm test`

Expected: Entire frontend test suite passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.js frontend/src/api/client.test.js frontend/src/api/auth.js
git commit -m "fix: recover stale csrf requests once"
```

### Task 2: Actionable Active-Attempt Chat Notice

**Files:**
- Modify: `frontend/src/components/ai-chat/AIChatBox.jsx`
- Modify: `frontend/src/i18n/translations.js`
- Modify: `frontend/src/App.test.js`

**Interfaces:**
- Consumes: Existing stable chat error code `CHAT_BLOCKED_DURING_ATTEMPT` and learner route `/history`.
- Produces: A localized action shown only for the active-attempt block that closes ChatBox and takes the learner to attempt history; all other chat errors retain the generic dismiss behavior.

- [ ] **Step 1: Write a failing UI contract test**

Extend the frontend source contract test to assert that `AIChatBox` handles `CHAT_BLOCKED_DURING_ATTEMPT` with a `/history` action and references a dedicated translation key.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd frontend && node --test src/App.test.js`

Expected: The new contract assertion fails because the actionable link and translation key do not exist.

- [ ] **Step 3: Implement the localized action**

Render a React Router link only when `chat.errorCode === "CHAT_BLOCKED_DURING_ATTEMPT"`. The action uses `/history`, closes ChatBox on activation, and has matching English/Vietnamese text such as “View attempt history” / “Xem lịch sử làm bài”. Keep the existing explanatory error copy and dismiss action.

- [ ] **Step 4: Run focused and full frontend checks**

Run: `cd frontend && node --test src/App.test.js`

Expected: Focused contract test passes.

Run: `cd frontend && npm run lint && npm test && npm run build`

Expected: Lint, full tests, and production build pass.

- [ ] **Step 5: Verify unchanged attempt-safety contracts**

Run: `cd frontend && node --test src/api/userLearningChatContext.test.js`

Expected: `IN_PROGRESS` attempts remain absent from ChatBox context choices.

Run: `cd backend && ./mvnw -Dtest=AttemptServiceTests,AIChatServiceTests test`

Expected: Timed attempts are reconciled, active untimed attempts still block chat, and AI Chat continues enforcing the guard.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ai-chat/AIChatBox.jsx frontend/src/i18n/translations.js frontend/src/App.test.js
git commit -m "fix: guide blocked chat users to attempts"
```

### Task 3: Final Cross-Service Verification and Review

**Files:**
- Review only: all files changed by Tasks 1-2

**Interfaces:**
- Consumes: Task 1 one-shot CSRF recovery and Task 2 actionable blocked state.
- Produces: Verified branch with no changes to backend API contracts, Firestore schema, quota behavior, or exam safety rules.

- [ ] **Step 1: Run required project checks**

Run: `cd backend && ./mvnw test`

Expected: Backend suite passes.

Run: `cd ai-service && ./mvnw test`

Expected: AI Service suite passes.

Run: `cd frontend && npm run lint && npm test && npm run build`

Expected: Frontend lint, tests, and build pass.

- [ ] **Step 2: Inspect scope and secrets**

Run: `git status --short && git diff --check && git diff HEAD~2 --stat`

Expected: Only planned source/test/translation files and this plan are changed; no `.env`, key, token, credential, generated output, dependency, API contract, or schema change is present.

- [ ] **Step 3: Request one independent whole-branch review**

Review the complete implementation against this plan, the Pro AI Chat design, the Review Focus items, and the project security/business invariants. Critical or important findings require one TDD fix pass and full verification before handoff.
