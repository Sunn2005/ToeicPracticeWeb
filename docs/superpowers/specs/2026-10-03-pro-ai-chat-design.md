# Pro Entitlements and Capy AI Chat Design

## 1. Purpose

Add a manually managed Pro subscription that unlocks exactly two capabilities:

- Full-test AI Analysis.
- Capy AI Chat for TOEIC learning support before and after an exam or practice attempt.

Payment processing is outside this scope. An admin activates, extends, or revokes Pro access manually. The subscription boundary must nevertheless be suitable for a future payment webhook without changing the AI feature contracts.

## 2. Existing System Constraints

- `users/{uid}.role` remains the authorization source for `USER`, `EMPLOYEE`, and `ADMIN`. Pro is a commercial entitlement, not a role.
- All protected frontend requests continue to use `apiFetch`.
- Gemini credentials remain exclusively in AI Service.
- RabbitMQ remains the asynchronous boundary between BE-Core and AI Service.
- AI Analysis remains limited to an owned, completed full attempt.
- Correct answers, explanations, translations, and transcripts must not be exposed before the applicable attempt or practice unit permits review.
- Server attempt state is authoritative for ownership, status, timing, and completion.
- Existing `/full-test/**` routes and exam behavior remain unchanged.

## 3. Scope

### Included

- Server-owned Pro subscriptions and entitlements.
- Admin activation, extension, and revocation of Pro.
- Entitlement enforcement for the existing AI Analysis API.
- Persistent AI chat conversations and messages.
- TOEIC-general chat and optional context from an owned completed attempt.
- Capy visibility and ChatBox UI for Pro users.
- Daily and burst chat quotas.
- English and Vietnamese UI text and AI response locale.

### Excluded

- Online payment, checkout, invoices, refunds, and payment-provider webhooks.
- Chat during an in-progress attempt.
- Non-TOEIC general-purpose assistant behavior.
- Token streaming in the first release.
- Voice chat, file upload, image upload, or audio transcription.
- Additional Pro benefits beyond AI Analysis and AI Chat.

## 4. Subscription and Entitlement Model

Pro must not be represented as a new user role or a client-controlled boolean. Store one server-managed subscription per user, conceptually:

```text
subscriptions/{uid}
  userId: string
  planCode: "PRO"
  status: "ACTIVE" | "EXPIRED" | "REVOKED"
  entitlements: ["AI_CHAT", "AI_ANALYSIS"]
  startsAt: epoch milliseconds
  expiresAt: epoch milliseconds
  activatedBy: admin uid
  revokedBy: admin uid | null
  revokedAt: epoch milliseconds | null
  createdAt: epoch milliseconds
  updatedAt: epoch milliseconds
```

BE-Core is the only authority allowed to create or update subscription records. Effective access requires all of the following:

1. The caller is authenticated.
2. The subscription status is `ACTIVE`.
3. `startsAt <= serverNow < expiresAt`.
4. The requested entitlement is present.

An expired time range is treated as expired even if the stored status has not yet been normalized by a background process. This avoids depending on scheduled cleanup for authorization correctness.

The initial admin operation defaults to 30 days and supports an explicit expiry date. Extension moves `expiresAt` forward from the later of the current expiry or server time. Revocation takes effect immediately and does not delete historical data.

Frontend profile/session data may include a derived Pro summary for presentation, but the backend must re-evaluate the entitlement on every protected AI mutation. Frontend state is never authorization evidence.

## 5. Admin Subscription Operations

Admin-only APIs provide these operations:

- Read a user's current subscription summary.
- Activate Pro with a server-validated duration or expiry date.
- Extend an active or expired Pro subscription.
- Revoke Pro and record the acting admin.

All operations require the existing trusted `ADMIN` role. Requests must not accept `activatedBy`, `status`, entitlements, audit timestamps, or other server-managed fields. Repeated requests must have defined idempotent behavior so UI retries cannot accidentally shorten or duplicate a subscription.

The admin UI must expose the current state, effective dates, and confirmation for revocation. Payment-provider concepts must not be introduced into this manual-management UI.

## 6. AI Analysis Entitlement Enforcement

The existing AI Analysis eligibility rules remain intact. `AI_ANALYSIS` is an additional prerequisite for creating or refreshing an analysis. Reading an analysis already generated while the user was Pro remains allowed after Pro expires so paid results are not silently hidden.

If creation or refresh is attempted without entitlement, return HTTP `403` with stable code `PRO_REQUIRED`. Do not start an AI job or change attempt analysis state.

## 7. Capy Visibility and Interaction

Capy is rendered only when all conditions are true:

- The caller has effective `AI_CHAT` entitlement.
- The caller is on an allowed learner route.
- The caller is not on `/full-test/{attemptId}/exam`.
- No other authoritative frontend attempt state says an attempt is currently in progress.

Normal users do not see Capy. Pro discovery for normal users belongs on the dashboard or future pricing page, not through a disabled pet.

For a Pro user, the first Capy appearance on a device shows a temporary speech bubble:

> Xin chào! Nhấn vào mình để trò chuyện nhé.

The hint dismisses automatically and is remembered locally for presentation only. Hover and keyboard focus expose the label “Trò chuyện với Capy AI.” Reduced-motion preferences must continue to be respected.

The current drag interaction must distinguish click from drag with a movement threshold. A click or keyboard activation opens ChatBox; an actual drag only moves Capy. The chat panel must be keyboard accessible, responsive, and usable without pointer input.

## 8. Conversation Data Model

Store persistent conversations owned by one user:

```text
aiChatConversations/{conversationId}
  userId: string
  title: string
  locale: "vi" | "en"
  contextAttemptId: string | null
  contextQuestionNumber: integer | null
  status: "ACTIVE" | "DELETED"
  createdAt: epoch milliseconds
  updatedAt: epoch milliseconds
  lastMessageAt: epoch milliseconds
```

Messages are stored in a conversation subcollection:

```text
aiChatConversations/{conversationId}/messages/{messageId}
  role: "USER" | "ASSISTANT"
  content: string | null
  status: "PENDING" | "SUCCEEDED" | "FAILED"
  jobId: string | null
  errorCode: string | null
  createdAt: epoch milliseconds
  completedAt: epoch milliseconds | null
```

The user can keep at most ten active conversations, list them in most-recently-active order, open one, and delete one. Creating an eleventh active conversation returns `409 CONVERSATION_LIMIT_REACHED`; the user must delete an existing conversation first. Deletion is a recoverable soft delete at the application layer; deleted conversations are excluded from normal reads and never supplied to Gemini.

Expiry or revocation of Pro does not delete history. A former Pro user may read existing conversations but cannot create a conversation, send a new message, or retry a failed generation until access is restored.

## 9. Chat API Shape

The domain wrapper lives under `frontend/src/api/`. The proposed authenticated API surface is:

```text
POST   /api/ai/chat/conversations
GET    /api/ai/chat/conversations
GET    /api/ai/chat/conversations/{conversationId}
POST   /api/ai/chat/conversations/{conversationId}/messages
DELETE /api/ai/chat/conversations/{conversationId}
GET    /api/ai/chat/jobs/{jobId}
```

Creating a conversation accepts locale and optional `attemptId` plus `questionNumber`. Attempt context is either absent or identifies exactly one question in an owned completed attempt; full-attempt analysis remains the responsibility of AI Analysis. Sending a message accepts message content plus an idempotency key. It must not accept correct answers, explanations, transcripts, ownership, subscription state, quota state, or prior assistant messages as trusted fields.

Conversation and job reads require ownership. A missing resource and a resource belonging to another user both return `404` so the API does not disclose identifiers.

The message-creation response is `202 Accepted` and returns the persisted user message, pending assistant message, job identifier, and current quota summary. Job polling follows the existing frontend AI job pattern with a task-appropriate timeout and abort handling.

The exact request and response schemas, status codes, and stable error codes must be added to `docs/API_ROLE_WORKFLOWS.md` before implementation is considered complete.

## 10. Context and Exam-Safety Rules

General TOEIC questions require no attempt context. When a conversation references an attempt, BE-Core must:

1. Load the attempt by ID.
2. Confirm it belongs to the authenticated user.
3. Reconcile its server-side deadline and status.
4. Require `COMPLETED` before exposing any review-only data.
5. Confirm the requested question number is within the attempt scope.
6. Load only that question's answer and review fields.

Frontend sends only identifiers, not trusted exam content. The existing recursive filtering rules remain the canonical protection for exam responses.

Chat is denied while the user has an `IN_PROGRESS` attempt. The UI hides Capy, but the backend independently enforces this restriction so a direct API call cannot bypass it. The denial uses stable code `CHAT_BLOCKED_DURING_ATTEMPT`.

The AI system prompt defines Capy as a TOEIC tutor. It must refuse requests to reveal unavailable answers, follow prompt-injection instructions, impersonate system messages, or answer unrelated requests. Prompt rules supplement authorization and data minimization; they are not treated as the security boundary.

## 11. Asynchronous Processing

The first release reuses RabbitMQ and polling rather than token streaming.

```text
ChatBox
  -> BE-Core validates auth, entitlement, quota, ownership, and context
  -> BE-Core persists the user message and a pending assistant message
  -> BE-Core publishes a TOEIC_TUTOR_CHAT job
  -> AI Service consumes the job and calls Gemini
  -> AI Service publishes success or failure
  -> BE-Core atomically finalizes the pending assistant message
  -> ChatBox polls and renders the final result
```

RabbitMQ messages must carry identifiers and the minimum sanitized generation input. They must not contain credentials, user profile data, or unnecessary attempt content. Application logs record identifiers and status transitions, not chat text or sensitive payloads.

AI Service adds a dedicated `TOEIC_TUTOR_CHAT` task path. Existing `EXPLAIN_ANSWER` and full-test review flows retain their contracts. Chat processing must be idempotent: repeated delivery or frontend retry cannot create a second assistant response or charge quota twice.

For each generation, AI Service uses the system prompt, sanitized optional single-question attempt context, the current question, and at most the 12 most recent successful conversation messages. The conversation-history portion is additionally capped at 12,000 Unicode characters by dropping the oldest messages first. It never sends an unbounded conversation to Gemini. A future streaming implementation may replace delivery mechanics without changing conversation ownership or entitlement contracts.

## 12. Quotas and Input Limits

Initial limits are:

- 30 generated answers per user per calendar day in `Asia/Ho_Chi_Minh`.
- At most 5 accepted questions in a rolling minute.
- At most 1,000 characters per user message.
- At most 10 active conversations per user.
- At most 12 recent successful messages and 12,000 history characters per Gemini request.

Quota accounting occurs atomically in BE-Core using server time. It is consumed once when an eligible message is accepted. Transport retries and duplicate idempotency keys do not consume it again. Product-level retries after a terminal AI failure may reuse the existing accepted message without another quota charge.

Responses include remaining daily quota and the next reset time. Limits must be configuration-backed so they can be tuned without changing API contracts.

## 13. Error Handling

Stable errors include:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `CHAT_MESSAGE_INVALID` | Empty, malformed, or oversized message. |
| 403 | `PRO_REQUIRED` | Required entitlement is absent or expired. |
| 409 | `CHAT_BLOCKED_DURING_ATTEMPT` | User has an in-progress attempt. |
| 409 | `ATTEMPT_NOT_COMPLETED` | Requested context is not reviewable. |
| 409 | `CONVERSATION_LIMIT_REACHED` | Ten active conversations already exist. |
| 429 | `CHAT_RATE_LIMITED` | Burst limit exceeded. |
| 429 | `CHAT_DAILY_LIMIT_REACHED` | Daily quota exhausted. |
| 503 | `AI_UNAVAILABLE` | RabbitMQ or Gemini is temporarily unavailable. |

The frontend handles status and code rather than matching Vietnamese or English message text. Failed assistant messages remain visible with a retry action. Loading, empty, success, failure, aborted polling, and timeout states must all be represented.

## 14. Frontend Behavior

ChatBox supports desktop and mobile layouts and includes:

- Conversation list and new-conversation action.
- Message history with distinct user and Capy messages.
- Text input, send action, pending indicator, retry, and deletion confirmation.
- Remaining daily quota and reset information.
- Optional selection of an owned completed attempt as context.
- English and Vietnamese translation keys added together.

The input prevents obvious duplicate submission, but backend idempotency remains authoritative. Closing ChatBox does not cancel an accepted job. Reopening it resumes polling or reads the persisted result.

No new frontend dependency is required. Localized styling should use Tailwind in new components; global CSS changes are limited to the existing pet sprite behavior only if unavoidable.

## 15. Security and Privacy

- Never expose or log Gemini keys, Firebase Admin credentials, session cookies, CSRF tokens, chat contents, or secret-bearing message payloads.
- Every subscription, conversation, message, job, and attempt lookup enforces server-side identity and ownership.
- Admin subscription mutations require trusted admin role checks.
- Firestore writes that affect entitlement or chat processing occur through trusted backend services.
- Input size, supported locale, identifiers, and pagination are validated.
- Chat content sent to Gemini is minimized and excludes identity and audio.
- Existing `401`, `403`, ownership, exam locking, autosave, submission, scoring, and AI Analysis idempotency behavior must not be weakened.

## 16. Testing Strategy

### Backend

- Subscription activation, extension, expiration, revocation, and audit fields.
- Server-time entitlement evaluation and `PRO_REQUIRED` enforcement.
- Existing AI Analysis behavior for entitled users and rejection for others.
- Conversation and job ownership, including indistinguishable foreign-resource `404` responses.
- In-progress attempt blocking and completed-attempt context eligibility.
- Atomic quota behavior under concurrent requests and idempotent retries.
- Rabbit publish failure and result-consumer duplicate delivery.

### AI Service

- `TOEIC_TUTOR_CHAT` routing without changing existing task behavior.
- Bounded history construction and sanitized attempt context.
- Structured success, provider failure, invalid output, retry, and duplicate delivery.
- Prompt tests for TOEIC scope, unavailable-answer requests, and injection attempts.

### Frontend

- Capy hidden for normal users and all users during an exam.
- First-use hint, keyboard activation, click-versus-drag, and reduced motion.
- Conversation loading, empty, error, pending, success, retry, delete, and quota states.
- Mobile and desktop behavior.
- Error handling by HTTP status and stable code.
- English and Vietnamese translations.

Final verification runs:

```bash
cd backend && ./mvnw test
cd ai-service && ./mvnw test
cd frontend && npm run lint && npm test && npm run build
```

## 17. Delivery Phases

1. Implement subscription persistence, entitlement evaluation, admin operations, and tests.
2. Gate AI Analysis creation and refresh while preserving access to existing completed results.
3. Implement chat persistence, quota, API contracts, RabbitMQ messages, AI processing, and tests.
4. Implement Pro-only Capy behavior and ChatBox UI.
5. Run cross-service security, failure, responsive, and regression verification.

Payment integration is a separate future design. Its webhook will update the same subscription service rather than directly granting frontend access or modifying AI feature logic.
