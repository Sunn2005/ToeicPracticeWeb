# Admin-created staff accounts and credential lifecycle

## Approved behavior
Admin creates a new account with name, contact-only phone, email (login identifier), group, active flag and optional notes. Existing emails in either Firebase Auth or Firestore are rejected. Send a random temporary password by email, require a password change on first login, expire temporary access after 24 hours. Account creation and email delivery are separate states; resend rotates the password, invalidates previous credentials and is rate limited to 60 seconds. Console login supports a generic forgot-password request and a single-use, expiring reset link. Both Admin and Employee have a profile password dialog with current/new/confirm password. Successful changes revoke all sessions and require login again.

## Design and boundaries
Keep Firebase Auth as credential authority and Firestore users.role/group permissions as authorization authority. Never return or persist plaintext temporary passwords. Store only reset token hashes and lifecycle metadata in server-managed fields; exclude internal fields from API responses. Enforce temporary credential restrictions at the backend, including direct API calls; allow only profile read and password completion. Preserve ownership, exams, payments and AI behavior. Use a server-configured Gmail SMTP mail gateway. The user explicitly approved adding Spring Boot Mail. No live account creation, email sends or deployment during local implementation.

## Implementation plan
1. Add an isolated Firebase account gateway, server credential-state store, mail gateway and credential lifecycle service. Serialize credential mutations with Firestore transactions; guard duplicate email races with Firebase uniqueness and transactional profile checks. Keep failed mail visible and recoverable. Compensate failed provisioning without deleting pre-existing accounts.
2. Change staff creation request to name/phone/email/group/active/notes; retain update/delete/group semantics. Add status metadata and a resend endpoint. Update API contracts explicitly.
3. Add forgot/reset/change-password endpoints with CSRF, generic recovery responses, hashed one-time tokens, expiry/rate limits, current-password verification, revocation and server enforcement of forced changes.
4. Update staff form/status/resend controls, Console forgot/reset/first-change views, and Console profile dialog for both roles. Add every translation in EN and VI. Keep styling local and accessible.
5. Add focused backend lifecycle/security tests and frontend API/route tests; run backend tests and frontend lint/test/build. Review the final diff and document configuration and operational limits.

## Open configuration
User selected Gmail App Password and approved Spring Boot Mail. No secrets requested in chat; actual SMTP and Firebase Web API configuration must be supplied through the backend runtime environment.

## Verification and review
Implemented on `codex/staff-account-credentials`. Backend: 328 tests passed. Frontend: lint passed, 124 tests passed, production build passed (existing large-chunk advisory remains). `git diff --check` passed. Browser smoke checks used an isolated localhost fixture API: direct creation form, account retained after mail failure, resend confirmation/success, profile password dialog, and generic forgot-password response. No real account or email was created. Temporary fixture servers were stopped. Gmail delivery and real Firebase credential round trips still require runtime configuration and an authorized integration check. Process-interruption recovery is documented in STAFF_ACCOUNT_SETUP; credential locks deliberately do not expire automatically.
