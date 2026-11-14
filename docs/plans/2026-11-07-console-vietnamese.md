# Vietnamese for internal pages

Scope: presentation language only; preserve API, permissions, exam and AI behavior.

1. Inspect the language provider, language switcher, console routes and project contracts.
2. Apply Vietnamese to `/console` and its child routes, and to ADMIN/EMPLOYEE sessions, using a provider inside the existing auth/router contexts.
3. Keep the learner's stored language preference separate from the effective language; hide and disable switching while Vietnamese is fixed.
4. Verify guest/user EN/VI, internal routes (including login/password pages), and internal roles through rendered integration checks. Run frontend lint, tests and build; review the diff and preserve unrelated changes.
