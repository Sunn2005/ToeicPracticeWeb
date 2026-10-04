# AI Chat Final Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six Important lifecycle, idempotency, delivery, and accessibility defects found by the final independent review without changing the approved ChatBox product scope.

**Architecture:** Keep BE-Core authoritative for chat/quota state and use the AI service's existing Firestore save-before-publish pattern for a small job-keyed result outbox. Make frontend asynchronous state transitions conversation-scoped, retain an idempotency key only for transport outcomes whose server acceptance is unknown, and share a visibility-aware focus helper between both dialog traps.

**Tech Stack:** React 19 hooks/reducer, Node test runner, Spring Boot 4.1, Firestore transactions/documents, RabbitMQ, JUnit 5, Mockito.

**Spec:** `docs/superpowers/specs/2026-10-03-pro-ai-chat-design.md`

## Global Constraints

- Backend remains the source of truth for role, entitlement, ownership, quotas, and terminal chat state.
- Chat remains absent during an active exam and never exposes restricted test content.
- No new dependency, secret, token streaming, billing, or API response-shape change.
- Existing historical reads after Pro expiry remain available.
- Use TDD for every production change and run all three project suites before completion.

## Review Focus

- Close while a job is pending, then reopen: the active conversation is reloaded and polling resumes.
- Switch from conversation A to B while A's send is in flight: B never receives A's optimistic messages.
- Lose an HTTP response after backend acceptance: retry reuses the same key; confirmed rejection or terminal retry uses a new key.
- Fail after backend admission or after Gemini success: every accepted job becomes recoverable/terminal and a saved success is replayed rather than regenerated.
- Traverse focus in both desktop/mobile and while delete confirmation is open: only visible controls participate and only the top dialog owns the trap.

---

### Task 1: Frontend Conversation Lifecycle and Idempotent Transport Retry

**Files:**
- Create: `frontend/src/hooks/aiChatSendAttempts.js`
- Create: `frontend/src/hooks/aiChatSendAttempts.test.js`
- Modify: `frontend/src/hooks/useAIChat.js`
- Modify: `frontend/src/hooks/aiChatState.js`
- Modify: `frontend/src/hooks/aiChatState.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: conversation-scoped `MESSAGE_ACCEPTED` actions and a send-attempt registry keyed by conversation/content.
- Produces: reopening reloads the previously active conversation and restarts pending polling.

- [ ] Write failing reducer tests proving an acceptance for A cannot alter B and a helper test proving reopen selects the retained active conversation.
- [ ] Run focused Node tests and confirm failures are caused by the missing scope/recovery behavior.
- [ ] Add conversation IDs to async actions, reload the retained active conversation after the enabled list refresh, and poll its pending jobs.
- [ ] Write failing send-attempt tests proving unknown transport failure retains the UUID while HTTP failure/success clears it.
- [ ] Implement the minimal registry and use it in `sendMessage`; confirmed terminal retry continues to allocate a fresh key.
- [ ] Run focused tests, then the complete frontend test suite and lint.
- [ ] Commit as `fix: harden AI chat frontend lifecycle`.

### Task 2: Accessible Dialog Focus Ownership

**Files:**
- Create: `frontend/src/components/ai-chat/focusTrap.js`
- Create: `frontend/src/components/ai-chat/focusTrap.test.js`
- Modify: `frontend/src/components/ai-chat/AIChatBox.jsx`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `visibleFocusableElements(container)` that excludes controls without client rectangles.

- [ ] Write failing helper tests for visible/hidden/disabled controls and top-dialog ownership.
- [ ] Run the focused test and confirm failure from the missing helper.
- [ ] Use the helper in both traps and suspend the outer Tab trap while delete confirmation is active.
- [ ] Run focused tests plus complete frontend lint/test/build.
- [ ] Commit as `fix: keep Capy dialog focus on visible controls`.

### Task 3: BE-Core Post-Admission Failure Terminalization

**Files:**
- Modify: `backend/src/test/java/com/toeic/service/AIChatServiceTests.java`
- Modify: `backend/src/main/java/com/toeic/service/AIChatService.java`

**Interfaces:**
- Produces: any history-build or publish exception after a newly accepted job attempts to finalize that job as `FAILED/AI_UNAVAILABLE` and returns stable `AI_UNAVAILABLE`.

- [ ] Write a failing service regression where admission succeeds and `listMessages` throws; assert terminalization and no publish.
- [ ] Run the focused Maven test and confirm the pending-job defect.
- [ ] Move all fallible post-admission request preparation into one failure boundary while preserving the duplicate-key fast path.
- [ ] Run focused and complete credential-free backend suites.
- [ ] Commit as `fix: terminalize chat jobs after admission failures`.

### Task 4: AI-Service Durable Chat Result Outbox

**Files:**
- Create: `ai-service/src/main/java/com/toeic/ai_service/service/FirestoreChatResultRepository.java`
- Create: `ai-service/src/main/java/com/toeic/ai_service/service/AIChatProcessor.java`
- Create: `ai-service/src/test/java/com/toeic/ai_service/service/AIChatProcessorTests.java`
- Modify: `ai-service/src/main/java/com/toeic/ai_service/messaging/AIChatRequestConsumer.java`
- Modify: `ai-service/src/test/java/com/toeic/ai_service/messaging/AIChatRequestConsumerTests.java`
- Modify: `docs/AI_REVIEW.md`
- Modify: `docs/API_ROLE_WORKFLOWS.md`

**Interfaces:**
- Produces: Firestore `aiChatGenerationResults/{jobId}` documents containing identifiers and one terminal sanitized result.
- Produces: `AIChatProcessor.process(AIChatRequest)` loads a saved terminal result or generates and saves once, then publishes that exact result.

- [ ] Write failing processor tests proving save-before-publish and replay-after-publish-failure without a second Gemini call.
- [ ] Run focused tests and confirm missing processor/repository behavior.
- [ ] Implement a transactionally create-once result repository, processor, and thin listener delegation; do not store request history/current chat content in the outbox.
- [ ] Update docs with the outbox collection, ownership, replay, and retention expectations.
- [ ] Run focused and complete AI-service suites.
- [ ] Commit as `fix: persist chat results before Rabbit delivery`.

### Task 5: Contract Correction and Final Verification

**Files:**
- Modify: `frontend/README.md`

**Interfaces:**
- Documents: actual `/api/ai/chat/**` paths and historical-read behavior after Pro expiry.

- [ ] Correct the documented paths and readable-after-expiry note.
- [ ] Run frontend lint/test/build, backend credential-free tests, AI-service tests, `git diff --check`, and secret/file-scope checks.
- [ ] Review the complete remediation diff and commit as `docs: correct AI chat frontend contract`.
