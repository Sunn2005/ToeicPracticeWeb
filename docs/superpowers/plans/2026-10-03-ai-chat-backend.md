# Capy AI Chat Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent, quota-controlled, asynchronous TOEIC chat across BE-Core, Firestore, RabbitMQ, and AI Service.

**Architecture:** BE-Core owns authorization, entitlement, attempt safety, persistence, quota, and idempotency. AI Service receives bounded sanitized context, calls Gemini for a TOEIC-tutor answer, and returns identifier-based results through dedicated RabbitMQ routes; the frontend later polls BE-Core only.

**Tech Stack:** Java 21, Spring Boot 4.1/4.1.1, Firebase Admin/Firestore, RabbitMQ, Spring AI Google GenAI, JUnit 5, Mockito.

**Spec:** `docs/superpowers/specs/2026-10-03-pro-ai-chat-design.md`

## Global Constraints

- Requires the completed Pro entitlement plan and `Entitlement.AI_CHAT`.
- Chat is unavailable while any owned attempt is `IN_PROGRESS` after deadline reconciliation.
- Attempt context identifies exactly one owned completed question by `attemptId` and `questionNumber`.
- Input is at most 1,000 characters; quotas are 30/day in `Asia/Ho_Chi_Minh` and 5/rolling minute.
- Maximum 10 active conversations; Gemini history is at most 12 successful messages and 12,000 Unicode characters.
- RabbitMQ processing and retries must be idempotent; no chat text or sensitive attempt payloads in logs.
- No token streaming and no new dependency.

## Review Focus

- Two concurrent sends with one idempotency key must create one user message, one pending assistant message, and one quota charge; pin in `AIChatServiceTests` and DAO transaction tests.
- An `IN_PROGRESS` attempt whose deadline has elapsed must be reconciled before chat blocking is decided; pin in `ChatAttemptContextServiceTests`.
- A foreign conversation, job, attempt, or out-of-scope question must not disclose existence or content; pin in service/controller tests.
- Duplicate RabbitMQ success or failure delivery must not overwrite a terminal assistant message; pin in `AIChatResultServiceTests`.
- Oversized history with multibyte Vietnamese text must drop oldest messages and stay within 12 messages/12,000 Unicode characters; pin in `AIChatPromptServiceTests`.

---

### Task 1: Chat Domain, DAO Contracts, and Firestore Mapping

**Files:**
- Create: `backend/src/main/java/com/toeic/model/AIChatConversation.java`
- Create: `backend/src/main/java/com/toeic/model/AIChatMessage.java`
- Create: `backend/src/main/java/com/toeic/model/AIChatJob.java`
- Create: `backend/src/main/java/com/toeic/model/AIChatQuota.java`
- Create: `backend/src/main/java/com/toeic/dao/AIChatDao.java`
- Create: `backend/src/main/java/com/toeic/dao/firestore/FirestoreAIChatDao.java`
- Test: `backend/src/test/java/com/toeic/dao/firestore/FirestoreAIChatDaoTests.java`

**Interfaces:**
- Produces: DAO operations to list/load/soft-delete conversations, load ordered messages, atomically accept an idempotent message with quota checks, load owned jobs, and atomically finalize a pending assistant message.
- Produces: immutable `AcceptedChatMessage(conversation, userMessage, assistantMessage, job, quotaSummary, newlyAccepted)` returned by the atomic acceptance method.

- [ ] **Step 1: Write failing Firestore DAO tests** for collection paths, active-conversation ordering/limit, soft deletion, ownership filters, and terminal-message idempotency.
- [ ] **Step 2: Run** `cd backend && ./mvnw -Dtest=FirestoreAIChatDaoTests test`; expect compile failure for missing domain/DAO types.
- [ ] **Step 3: Implement focused domain classes and DAO contract** with exact statuses from the spec.
- [ ] **Step 4: Implement Firestore mapping and transactions** using `aiChatConversations/{id}`, `messages/{id}`, `aiChatJobs/{jobId}`, and `aiChatUsage/{uid_yyyy-MM-dd}`; retain rolling-minute accepted timestamps needed for the burst limit.
- [ ] **Step 5: Add transaction tests** for duplicate idempotency key, daily limit, rolling-minute limit, conversation limit, and duplicate terminal delivery.
- [ ] **Step 6: Run the focused DAO tests**; expect PASS.
- [ ] **Step 7: Commit** with message `feat: add persistent AI chat domain`.

### Task 2: Attempt Safety and Single-Question Context

**Files:**
- Create: `backend/src/main/java/com/toeic/service/ChatAttemptContextService.java`
- Create: `backend/src/main/java/com/toeic/dto/ai/AIChatQuestionContext.java`
- Modify: `backend/src/main/java/com/toeic/service/AttemptService.java`
- Test: `backend/src/test/java/com/toeic/service/ChatAttemptContextServiceTests.java`
- Modify: `backend/src/test/java/com/toeic/service/AttemptServiceTests.java`

**Interfaces:**
- Produces: `void AttemptService.requireNoInProgressAttempt(String userId)` using existing deadline reconciliation.
- Produces: `AIChatQuestionContext ChatAttemptContextService.resolve(String userId, String attemptId, Integer questionNumber)` containing only prompt, options, correct answer, selected answer, permitted explanation/translations/transcript, part number, and question number.

- [ ] **Step 1: Add failing AttemptService tests** for active attempt denial, elapsed attempt reconciliation, and no-active-attempt success.
- [ ] **Step 2: Add failing context tests** for owned completed attempt, foreign attempt as `404`, incomplete attempt as `ATTEMPT_NOT_COMPLETED`, missing/out-of-scope question, and permitted review fields only.
- [ ] **Step 3: Run focused tests**; expect compile/assertion failures.
- [ ] **Step 4: Implement the public safety method and context service** by reusing existing attempt/test review logic rather than duplicating secret-filter behavior.
- [ ] **Step 5: Re-run focused tests**; expect PASS.
- [ ] **Step 6: Commit** with message `feat: enforce safe AI chat attempt context`.

### Task 3: Chat Application Service and REST API

**Files:**
- Create: `backend/src/main/java/com/toeic/dto/CreateChatConversationRequest.java`
- Create: `backend/src/main/java/com/toeic/dto/SendChatMessageRequest.java`
- Create: `backend/src/main/java/com/toeic/service/AIChatService.java`
- Create: `backend/src/main/java/com/toeic/controller/AIChatController.java`
- Test: `backend/src/test/java/com/toeic/service/AIChatServiceTests.java`
- Test: `backend/src/test/java/com/toeic/controller/AIChatControllerTests.java`

**Interfaces:**
- Consumes: `SubscriptionService.requireEntitlement`, `AttemptService.requireNoInProgressAttempt`, `ChatAttemptContextService.resolve`, and `AIChatDao`.
- Produces: the six chat endpoints from the spec; `sendMessage(userId, conversationId, content, idempotencyKey)` returns HTTP-ready accepted message/job/quota data.

- [ ] **Step 1: Write failing service tests** for Pro enforcement, message trimming/1,000-character validation, conversation cap, ownership-as-404, in-progress attempt block, context resolution, quota codes, and duplicate idempotency without republish.
- [ ] **Step 2: Run** `cd backend && ./mvnw -Dtest=AIChatServiceTests test`; expect compile failure.
- [ ] **Step 3: Implement DTO validation and `AIChatService`** with configuration-backed limits and stable codes from the spec.
- [ ] **Step 4: Write failing controller tests** for all paths, 202 message creation, encoded identifiers, ownership behavior, and readable history after Pro expiry while mutations are denied.
- [ ] **Step 5: Implement `AIChatController`** under `/api/ai/chat`, authenticated by the existing session security.
- [ ] **Step 6: Run service/controller tests**; expect PASS.
- [ ] **Step 7: Commit** with message `feat: add AI chat REST API`.

### Task 4: Dedicated RabbitMQ Chat Topology and BE-Core Messages

**Files:**
- Create: `backend/src/main/java/com/toeic/dto/ai/AIChatRequest.java`
- Create: `backend/src/main/java/com/toeic/dto/ai/AIChatResult.java`
- Create: `backend/src/main/java/com/toeic/service/AIChatRequestPublisher.java`
- Create: `backend/src/main/java/com/toeic/service/AIChatResultService.java`
- Create: `backend/src/main/java/com/toeic/messaging/AIChatResultConsumer.java`
- Modify: `backend/src/main/java/com/toeic/config/RabbitMessagingConfig.java`
- Modify: `backend/src/main/resources/application.properties`
- Test: `backend/src/test/java/com/toeic/service/AIChatResultServiceTests.java`

**Interfaces:**
- Produces routing keys `ai.chat.request` and `ai.chat.result` with durable queues `toeic.ai.chat.request` and `toeic.ai.chat.result`; request queue uses the existing DLX.
- Produces request identifiers plus locale, bounded history candidates, current user message, and sanitized single-question context; result includes job/message IDs, `SUCCEEDED|FAILED`, answer, and stable error code.

- [ ] **Step 1: Write failing result-service tests** for success, failure, foreign/mismatched identifiers, duplicate terminal delivery, and absent job.
- [ ] **Step 2: Run the focused test**; expect compile failure.
- [ ] **Step 3: Add DTOs, topology properties/beans, publisher, result service, and consumer**; log identifiers/status only.
- [ ] **Step 4: Connect `AIChatService` accepted messages to the publisher** and mark publish failure as `AI_UNAVAILABLE` without double charging a retry.
- [ ] **Step 5: Run** `cd backend && ./mvnw test`; expect PASS.
- [ ] **Step 6: Commit** with message `feat: add AI chat messaging workflow`.

### Task 5: AI Service Chat Prompt and Consumer

**Files:**
- Create: `ai-service/src/main/java/com/toeic/ai_service/model/AIChatRequest.java`
- Create: `ai-service/src/main/java/com/toeic/ai_service/model/AIChatResult.java`
- Create: `ai-service/src/main/java/com/toeic/ai_service/model/ToeicChatAnswer.java`
- Create: `ai-service/src/main/java/com/toeic/ai_service/service/AIChatPromptService.java`
- Create: `ai-service/src/main/java/com/toeic/ai_service/messaging/AIChatRequestConsumer.java`
- Modify: `ai-service/src/main/java/com/toeic/ai_service/config/RabbitMqConfig.java`
- Modify: `ai-service/src/main/resources/application.properties`
- Test: `ai-service/src/test/java/com/toeic/ai_service/service/AIChatPromptServiceTests.java`
- Test: `ai-service/src/test/java/com/toeic/ai_service/messaging/AIChatRequestConsumerTests.java`

**Interfaces:**
- Consumes: Task 4 request schema and publishes its result schema.
- Produces: `ToeicChatAnswer answer(AIChatRequest request)` with localized plain-text `content`; prompt accepts only `vi|en` and applies 12-message/12,000-character oldest-first truncation.

- [ ] **Step 1: Write failing prompt tests** for VI/EN instructions, TOEIC-only scope, unavailable-answer refusal, prompt-injection resistance text, single-question context, 12-message cap, and 12,000-character cap with Vietnamese input.
- [ ] **Step 2: Run** `cd ai-service && ./mvnw -Dtest=AIChatPromptServiceTests test`; expect compile failure.
- [ ] **Step 3: Implement models and `AIChatPromptService`** with Spring AI `ChatClient`; do not log prompt or response content.
- [ ] **Step 4: Write failing consumer tests** for success publication, provider failure normalization to `AI_UNAVAILABLE`, invalid request rejection, and identifier preservation.
- [ ] **Step 5: Add chat queues/bindings and implement consumer** without changing `EXPLAIN_ANSWER` or AI Review consumers.
- [ ] **Step 6: Run** `cd ai-service && ./mvnw test`; expect PASS.
- [ ] **Step 7: Commit** with message `feat: generate Capy TOEIC chat responses`.

### Task 6: Contracts, Configuration, and Cross-Service Verification

**Files:**
- Modify: `docs/API_ROLE_WORKFLOWS.md`
- Modify: `docs/AI_REVIEW.md`
- Modify: `backend/.env.example`
- Modify: `ai-service/.env.example`

**Interfaces:**
- Documents: exact schemas, ownership, readable-after-expiry rule, quota/reset behavior, stable codes, RabbitMQ routes, Firestore collections, and local run variables.

- [ ] **Step 1: Document exact chat API request/response examples** including `idempotencyKey`, quota summary, polling states, and all stable errors.
- [ ] **Step 2: Document RabbitMQ/Firestore flow and configuration-backed limits** without including credentials.
- [ ] **Step 3: Run** `cd backend && ./mvnw test` and `cd ai-service && ./mvnw test`; expect all PASS.
- [ ] **Step 4: Review** `git diff --check`, `git status --short`, and the scoped diff for secret leakage, payload logging, and unrelated files.
- [ ] **Step 5: Commit** with message `docs: document Capy AI chat backend`.

