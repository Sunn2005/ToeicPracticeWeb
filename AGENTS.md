# AGENTS.md

## Project Architecture

- `frontend/`: React 19, React Router, Vite, Tailwind CSS, and Firebase Authentication.
- `backend/`: Spring Boot REST API, Spring Security, Firebase Admin, and Firestore.
- `ai-service/`: asynchronous AI processing through RabbitMQ, Firestore, and Gemini.
- Treat `docs/archive/API_ROLE_WORKFLOWS.md`, `docs/archive/AI_REVIEW.md`, `frontend/README.md`, and `docs/archive/TEAM_FRONTEND_ASSIGNMENTS.md` as the current project contracts.

## Workflow

First inspect the relevant code and documentation and keep the change within the requested scope.

Small, low-risk changes may be implemented directly after inspection. Examples include typo fixes, simple UI text changes, formatting, obvious localized bug fixes, and localized refactors.

For medium and large changes, use the Superpowers workflow:

1. Understand the existing behavior and constraints.
2. Brainstorm or design when needed.
3. Write a plan.
4. Implement.
5. Test.
6. Review the result.

A plan is required before implementing any change to:

- Architecture or service boundaries.
- API contracts or response shapes.
- Database or Firestore schemas.
- Authentication, authorization, roles, or ownership rules.
- Exam flow, timing, scoring, autosave, submission, or review behavior.
- AI workflows, messaging, job states, polling, prompts, or validation.

Do not require explicit user approval for every small change. Stop and ask when the requested work requires a material scope expansion, conflicts with project rules, or needs a product decision that cannot be inferred safely.

## Security

- Never commit or expose `.env` files, private keys, Firebase service-account JSON, tokens, shared credentials, or test accounts.
- Never place secrets in `VITE_*` variables; they are visible in browser bundles.
- The frontend must not contain Firebase Admin credentials.
- Protected APIs require a Firebase ID token.
- Firestore `users/{uid}.role` is the authorization source of truth. Never trust roles from request bodies, local storage, or frontend state.
- Preserve resource ownership checks and do not bypass `401` or `403` responses in the UI.
- Do not log tokens, private user data, sensitive responses, or secret-bearing message payloads.

## Business Invariants

- Never expose correct answers, explanations, translations, or transcripts before the applicable exam or practice unit permits them.
- Listening answers cannot be changed after their unit is locked.
- Exam timing and deadlines come from the server-side attempt state.
- Preserve autosave, submit confirmation, completed-attempt handling, scoring, and idempotent submission behavior.
- Attempts are accessible only to their owner.
- Preserve test workflow transitions:

  `DRAFT → PENDING_REVIEW → APPROVED`  
  `PENDING_REVIEW → REJECTED → DRAFT`

- Only approved tests appear in the public catalog.
- AI full-test analysis is user-initiated and limited to completed full attempts. Preserve its asynchronous, idempotent state flow and save-before-publish behavior.
- Do not fabricate unavailable AI statistics or metadata.

## API Rules

- Follow `docs/archive/API_ROLE_WORKFLOWS.md`; do not silently change paths, methods, authorization, schemas, status codes, or workflow semantics.
- Public frontend requests use `publicApiFetch`.
- Authenticated frontend requests use `apiFetch`; do not duplicate Firebase token logic in pages or components.
- Add domain-specific API wrappers under `frontend/src/api/`.
- Pass `FormData` directly and let the browser set the multipart boundary.
- Do not send or trust server-managed fields such as ownership, status, or review metadata.
- Handle API failures by HTTP status and error `code`, not by matching localized message text.
- Keep sensitive exam fields filtered recursively from exam responses.

## Frontend Conventions

- Preserve the current `/full-test/**` routes and do not build new features on the legacy `/practice/part5` flow.
- Prefer Tailwind classes within components; avoid global CSS changes for localized styling.
- Add every translation key in both English and Vietnamese. Do not rename or remove existing keys casually.
- Provide appropriate loading, empty, and error states and support desktop and mobile layouts.
- Respect the ownership and locked-file boundaries documented in `docs/archive/TEAM_FRONTEND_ASSIGNMENTS.md`.
- Do not add or upgrade dependencies without the required team approval.

## Testing and Review

Run checks proportionate to the changed area:

- Backend: `cd backend && ./mvnw test`
- AI service: `cd ai-service && ./mvnw test`
- Frontend: `cd frontend && npm run lint && npm test && npm run build`

Do not claim completion without reviewing the diff and verifying the relevant checks. Do not merge changes while required lint, tests, or builds are failing.

## Scope Discipline

- Modify only files necessary for the requested task.
- Preserve unrelated user changes and avoid opportunistic rewrites.
- Do not alter API contracts, permissions, exam behavior, or AI behavior merely to make a UI change work.
- Do not modify generated output, dependencies, configuration, shared infrastructure, or locked files unless the task requires it and project rules allow it.
- Inspect `git status` and the final diff before handing off work.
