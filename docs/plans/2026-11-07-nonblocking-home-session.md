# Nonblocking home session check

## Scope and design

- Render the public home page while `AuthProvider` checks `/api/me` in the background.
- Keep the existing session loading gate for every other route, preserving protected-page access, login redirects, staff password requirements, and exam behavior.
- Show an accessible account skeleton in the desktop/mobile public navigation until the session is known; reuse the English/Vietnamese `checkingSession` translation.
- Preserve the existing redirect from home to dashboard when an authenticated session is restored.
- Do not change backend authentication, API contracts, or session persistence. Existing unrelated working-tree changes are preserved. The user explicitly authorized work on `main`.

## Implementation and verification

1. Limit the global session loading screen to non-home routes.
2. Add the public navigation pending state without changing page content or global styles.
3. Add render regression coverage for home pending/anonymous states and protected routes pending session resolution.
4. Run frontend lint, tests, and build, then review the scoped diff.
