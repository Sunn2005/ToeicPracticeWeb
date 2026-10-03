# Capy AI Chat Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive, accessible ChatBox opened by Pro-only Capy with persistent conversations and asynchronous AI responses.

**Architecture:** Use the derived `/api/me` subscription summary only for presentation and rely on protected backend chat APIs for authority. A focused chat hook coordinates conversation state and polling; presentational components render the panel, history, messages, quota, and first-use hint without introducing dependencies.

**Tech Stack:** React 19, React Router, Tailwind CSS, existing `apiFetch`, Node built-in test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-10-03-pro-ai-chat-design.md`

## Global Constraints

- Requires the completed Pro entitlement and AI chat backend plans.
- Capy is absent for normal users and all users on `/full-test/{attemptId}/exam`.
- UI visibility is not authorization; handle backend `403 PRO_REQUIRED` and `409 CHAT_BLOCKED_DURING_ATTEMPT`.
- First-use hint is local presentation state only.
- Distinguish click from drag with an 8-pixel movement threshold.
- No new dependencies; use Tailwind and existing CSS sprite behavior.
- Add all translations in English and Vietnamese; preserve `/full-test/**` routes.

## Review Focus

- Pointer jitter below 8 pixels must open chat, while an 8-pixel-or-greater drag must only move Capy; pin in pure interaction tests.
- Pro expiry while ChatBox is open must disable sending after `PRO_REQUIRED` without deleting visible history; pin in hook reducer tests.
- Closing and reopening during a pending job must resume polling and render one assistant result; pin in hook tests.
- Mobile viewport and on-screen keyboard must not hide the composer; verify through responsive layout rules and build review.
- Keyboard activation, focus return, Escape close, and reduced-motion mode must remain usable; pin pure state tests and manual accessibility checklist.

---

### Task 1: Chat API Wrapper and Polling

**Files:**
- Create: `frontend/src/api/aiChat.js`
- Create: `frontend/src/api/aiChat.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `listConversations`, `createConversation`, `getConversation`, `sendChatMessage`, `deleteConversation`, `getChatJob`, and `waitForChatJob` with AbortSignal support.

- [ ] **Step 1: Write failing API tests** for exact methods, encoded IDs, body shapes, credentials inherited through `apiFetch`, terminal polling, timeout, and abort.
- [ ] **Step 2: Add the test file to the explicit `npm test` command and run** `cd frontend && npm test`; expect module-not-found failure.
- [ ] **Step 3: Implement the wrapper** following `src/api/aiJobs.js`, using the backend-provided job timeout contract and no direct `fetch`.
- [ ] **Step 4: Re-run** `cd frontend && npm test`; expect PASS.
- [ ] **Step 5: Commit** with message `feat: add AI chat frontend API`.

### Task 2: Deterministic Chat State Hook

**Files:**
- Create: `frontend/src/hooks/aiChatState.js`
- Create: `frontend/src/hooks/aiChatState.test.js`
- Create: `frontend/src/hooks/useAIChat.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces pure reducer/state helpers for conversations, active conversation, messages, quota, errors, and pending job IDs.
- Produces `useAIChat({ enabled, locale })` with actions `openConversation`, `startConversation`, `sendMessage`, `retryMessage`, `removeConversation`, and `resumePendingJobs`.

- [ ] **Step 1: Write failing reducer tests** for load/empty/error, optimistic accepted messages, one terminal result, retry without duplicate display, deletion, quota updates, `PRO_REQUIRED`, and resumed pending jobs.
- [ ] **Step 2: Add the test file to `npm test` and run it**; expect module-not-found failure.
- [ ] **Step 3: Implement the pure reducer/helpers** so async UI behavior can be tested without a DOM dependency.
- [ ] **Step 4: Implement `useAIChat`** using Task 1 APIs, AbortControllers, backend idempotency keys via `crypto.randomUUID()`, and cleanup on unmount.
- [ ] **Step 5: Run** `cd frontend && npm test`; expect PASS.
- [ ] **Step 6: Commit** with message `feat: manage persistent AI chat state`.

### Task 3: Accessible ChatBox Components

**Files:**
- Create: `frontend/src/components/ai-chat/AIChatBox.jsx`
- Create: `frontend/src/components/ai-chat/ConversationList.jsx`
- Create: `frontend/src/components/ai-chat/ChatMessageList.jsx`
- Create: `frontend/src/components/ai-chat/ChatComposer.jsx`
- Create: `frontend/src/components/ai-chat/AttemptQuestionContextPicker.jsx`

**Interfaces:**
- Consumes: state/actions from `useAIChat` and completed-attempt choices provided through existing learner APIs.
- Produces: controlled panel with conversation navigation, context creation, messages, retry, quota, deletion confirmation, and composer.

- [ ] **Step 1: Implement semantic component shells** with labeled controls, `aria-live` for assistant updates, `role="dialog"`, focusable close control, and empty/loading/error states.
- [ ] **Step 2: Implement desktop/mobile layout** using Tailwind: anchored panel on desktop and viewport-safe sheet on mobile with a sticky composer.
- [ ] **Step 3: Wire the context picker** to owned completed attempts and one question number; do not send question content or answers.
- [ ] **Step 4: Wire quota and stable error-code presentation** including reset time and read-only history after Pro loss.
- [ ] **Step 5: Run** `cd frontend && npm run lint && npm run build`; expect PASS.
- [ ] **Step 6: Commit** with message `feat: add accessible Capy ChatBox UI`.

### Task 4: Capy Pro Gating, Hint, and Click-versus-Drag

**Files:**
- Create: `frontend/src/components/floatingPetInteraction.js`
- Create: `frontend/src/components/floatingPetInteraction.test.js`
- Modify: `frontend/src/components/FloatingPet.jsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: pure helpers `movementDistance(start, current)` and `isDragGesture(start, current, threshold = 8)`.
- `FloatingPet` consumes `profile.subscription`, renders only effective `AI_CHAT`, emits `onOpenChat`, and owns local first-use hint key `capy-ai-chat-hint-seen-v1`.

- [ ] **Step 1: Write failing pure tests** for 0–7.99 pixel click, 8+ pixel drag, keyboard activation, and clamped movement calculations.
- [ ] **Step 2: Add the test to `npm test` and run**; expect module-not-found failure.
- [ ] **Step 3: Implement pure helpers and refactor pointer handling** so `pointerUp` opens chat only when the gesture did not cross the threshold.
- [ ] **Step 4: Add Pro gating and first-use speech bubble** that auto-dismisses, persists locally, and respects reduced motion; keep the current exam-route hard hide.
- [ ] **Step 5: Add hover/focus label and localized accessible name** without changing global button behavior.
- [ ] **Step 6: Run** `cd frontend && npm run lint && npm test && npm run build`; expect PASS.
- [ ] **Step 7: Commit** with message `feat: make Capy the Pro chat launcher`.

### Task 5: Application Integration and Lifecycle Safety

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/i18n/translations.js`
- Modify: `frontend/src/pages/user/UserDashboard.jsx`
- Modify: `frontend/src/api/userLearning.js`
- Create: `frontend/src/api/userLearningChatContext.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Integrates one ChatBox instance beside `FloatingPet` outside console routes.
- Produces `getChatEligibleAttempts()` from the existing attempt-history response and `getChatQuestionChoices(attemptId)` from the existing completed-attempt review endpoint; the picker retains only attempt ID, title, and question numbers and never forwards review content to the chat API.

- [ ] **Step 1: Write failing learner API tests** for the existing completed-attempt source and encoded context identifiers; add the test to `npm test`.
- [ ] **Step 2: Implement the minimal API helper** without duplicating token/session logic.
- [ ] **Step 3: Lift open/close state into the app-level learner shell** so route changes, exam entry, logout, and Pro loss close ChatBox safely; never alter existing full-test route definitions.
- [ ] **Step 4: Add a non-interactive dashboard card for normal users** explaining that Capy Chat and AI Analysis are Pro benefits; do not render Capy or link to a nonexistent payment checkout.
- [ ] **Step 5: Add all chat, quota, hint, error, and subscription copy in EN and VI** without renaming existing keys.
- [ ] **Step 6: Run** `cd frontend && npm run lint && npm test && npm run build`; expect PASS.
- [ ] **Step 7: Commit** with message `feat: integrate Capy AI chat for Pro learners`.

### Task 6: Frontend Contract Documentation and Final Verification

**Files:**
- Modify: `frontend/README.md`
- Modify: `docs/TEAM_FRONTEND_ASSIGNMENTS.md`

**Interfaces:**
- Documents: Pro-only visibility, hint behavior, polling lifecycle, stable error mapping, responsive/accessibility expectations, and ownership of new files.

- [ ] **Step 1: Update frontend documentation** with ChatBox behavior, local hint key, no-streaming expectation, and manual testing steps.
- [ ] **Step 2: Update team ownership/locked-file boundaries** for the new AI chat API, hook, components, and necessary shared integration points.
- [ ] **Step 3: Manually verify** desktop and mobile open/close, keyboard focus/Escape, click-versus-drag, first-use hint, reduced motion, pending close/reopen, normal-user absence, Pro expiry, and exam-route absence.
- [ ] **Step 4: Run** `cd frontend && npm run lint && npm test && npm run build`; expect all PASS.
- [ ] **Step 5: Review** `git diff --check`, `git status --short`, and the complete scoped diff; confirm `.DS_Store` and unrelated user changes are untouched.
- [ ] **Step 6: Commit** with message `docs: document Capy AI chat frontend`.
