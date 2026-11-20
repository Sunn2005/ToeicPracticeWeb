<!--
Sync Impact Report (temporary; remove before committing)
Version change: (unfilled template) → 1.0.0
Modified principles: none renamed (initial adoption; all placeholders replaced)
Added sections: Core Principles I–V, Technology & Architecture Constraints,
  Development Workflow & Quality Gates, Governance
Removed sections: none
Deferred TODOs: none
-->
# CapyTOEIC Constitution

## Core Principles

### I. Server-Side Authority & Security (NON-NEGOTIABLE)
Protected APIs MUST require a Firebase ID token. Firestore `users/{uid}.role` is the sole
authorization source; roles from request bodies, local storage, or frontend state MUST NOT be
trusted. Resource ownership checks MUST be preserved, and the UI MUST NOT bypass `401`/`403`
responses. Secrets (`.env`, service-account JSON, private keys, tokens, shared credentials) MUST
NOT be committed or placed in `VITE_*` variables, and tokens, private user data, and
secret-bearing payloads MUST NOT be logged.
Rationale: the frontend is untrusted and its bundle is public; leaks are irreversible.

### II. Exam Integrity & Business Invariants (NON-NEGOTIABLE)
Correct answers, explanations, translations, and transcripts MUST NOT be exposed before the
exam or practice unit permits them. Listening answers MUST NOT change after their unit is
locked. Timing and deadlines MUST come from server-side attempt state. Autosave, submit
confirmation, completed-attempt handling, scoring, and idempotent submission MUST be preserved.
Attempts are accessible only to their owner. Test workflow transitions are limited to
`DRAFT → PENDING_REVIEW → APPROVED` and `PENDING_REVIEW → REJECTED → DRAFT`; only approved
tests appear in the public catalog.
Rationale: score trustworthiness is the product's core value.

### III. Asynchronous & Honest AI Workflows
AI full-test analysis MUST be user-initiated and limited to completed full attempts, and MUST
keep its asynchronous, idempotent job-state flow and save-before-publish behavior. Changes to
AI messaging, job states, polling, prompts, or validation MUST follow `docs/archive/AI_REVIEW.md`.
Unavailable AI statistics or metadata MUST NOT be fabricated.
Rationale: AI output is advisory; duplicated or invented results erode user trust.

### IV. Contract-First, Layered Architecture
`frontend/` (React, Vite, Tailwind, Firebase Auth), `backend/` (Spring Boot MVC layers with
business packages inside each layer), and `ai-service/` (RabbitMQ, Firestore, Gemini) MUST keep
their service boundaries. API contracts and response shapes are defined by
`docs/archive/API_ROLE_WORKFLOWS.md`, `docs/archive/AI_REVIEW.md`, `frontend/README.md`, and
`docs/archive/TEAM_FRONTEND_ASSIGNMENTS.md`; any change to them MUST update the contract
document in the same change. Frontend code is organized by module under `src/modules/`.
Rationale: several team members work in parallel and rely on stable contracts.

### V. Plan-Gated, Scoped, Verified Changes
Changes MUST stay within the requested scope. Small, low-risk changes (typos, UI text,
formatting, obvious localized fixes) MAY be implemented directly after inspection. A written
plan is REQUIRED before changing architecture or service boundaries, API contracts, Firestore
schemas, authentication/authorization/roles/ownership, exam flow/timing/scoring/autosave/
submission/review, or AI workflows. Implemented changes MUST be tested and reviewed before
completion. Work MUST stop for user input when scope expands materially, conflicts with these
rules, or needs an unresolvable product decision.
Rationale: high-risk areas need design review; low-risk ones should not be slowed.

## Technology & Architecture Constraints

- Frontend: React 19, React Router, Vite, Tailwind CSS, Firebase Authentication; no Firebase
  Admin credentials in the frontend.
- Backend: Java 21, Spring Boot, Spring Security, Firebase Admin, Firestore, RabbitMQ; MVC
  layers `controller`, `service`, `dao`, `model`, `dto`, with role expressed through
  controller naming or authorization annotations, not separate layer trees.
- AI service: asynchronous processing via RabbitMQ and Firestore using Gemini.
- Existing dependencies and structure MUST be preferred over new libraries or services; a new
  dependency or service MUST be justified in the plan.

## Development Workflow & Quality Gates

- Before implementing a feature, a `researcher` subagent MUST be used to gather relevant
  documentation and code; coding begins only after findings are available (per `CLAUDE.md`).
- Medium and large changes follow: understand → design (if needed) → plan → implement → test
  → review.
- Spec Kit artifacts (spec, plan, tasks) for a feature MUST be consistent with this
  constitution; a plan's Constitution Check MUST pass or record justified exceptions.
- Always check `git status` before committing; never commit secrets or generated artifacts.
- Behavior changes to scoring, access control, or workflow transitions MUST include automated
  tests covering the invariant.

## Governance

This constitution supersedes other practices. Amendments require a documented change to this
file, a version bump, and an update to any affected contract document or guidance file
(`AGENTS.md`, `CLAUDE.md`). Versioning follows semantic versioning: MAJOR for incompatible
principle removals or redefinitions, MINOR for new principles or materially expanded guidance,
PATCH for clarifications. All plans and reviews MUST verify compliance; deviations MUST be
justified in writing. Use `AGENTS.md` and `CLAUDE.md` for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-11-20 | **Last Amended**: 2026-11-20
