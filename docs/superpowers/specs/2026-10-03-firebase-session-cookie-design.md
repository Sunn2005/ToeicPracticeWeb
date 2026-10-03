# Firebase Session Cookie Authentication Design

## Goal

Move long-lived Firebase credentials out of browser-managed persistent storage. The frontend will use Firebase Authentication only to complete the interactive Google or email/password sign-in, then exchange the resulting Firebase ID token for an HttpOnly Firebase session cookie created by the backend.

The change must preserve the existing Firestore role model, API authorization rules, exam behavior, attempt ownership, autosave, scoring, and AI workflows.

## Deployment topology

- Frontend: `https://capytoeic.id.vn`
- Backend public URL: `https://api.capytoeic.id.vn`
- Backend hosting remains on Render; the new hostname is a Render custom domain.
- Local frontend: `http://localhost:5173`
- Local backend: `http://localhost:8080`

The production frontend and API therefore remain same-site while using different origins. Production cookies can use `SameSite=Lax` without becoming third-party cookies.

## Authentication flow

### Create a session

1. The browser signs in with the existing Firebase Web SDK flow.
2. The frontend obtains a freshly issued Firebase ID token in memory.
3. The frontend requests a CSRF token from `GET /api/v1/auth/csrf`.
4. The frontend sends the ID token to `POST /api/v1/auth/session` with credentials enabled and the CSRF header.
5. The backend verifies the ID token with Firebase Admin and rejects tokens whose `auth_time` is older than five minutes.
6. The backend creates a Firebase session cookie with a fixed seven-day lifetime.
7. The backend synchronizes or creates the Firestore user using the verified Firebase identity. New users still receive role `USER`; roles from request bodies or client state are never trusted.
8. The backend returns the profile as JSON and sets the session cookie.
9. The frontend signs out the temporary Firebase client user and keeps only the backend profile in React state.

The ID token is never written explicitly to localStorage, sessionStorage, or a JavaScript cookie. The Firebase client will use in-memory persistence during the short exchange.

### Authenticate API requests

All frontend API requests use `credentials: "include"`. The Spring Security filter reads the session cookie, verifies it with `FirebaseAuth.verifySessionCookie(cookie, true)`, loads the user and Firestore role, and creates the existing `ToeicUserPrincipal` authentication object.

Business controllers and services continue to receive the same authenticated principal and role authorities. Bearer-token authentication is removed from the frontend and is not retained as a production fallback.

### Restore browser state

On application startup, `AuthProvider` calls `GET /api/me` with credentials enabled:

- `200`: populate the user profile and role.
- `401`: treat the visitor as signed out.
- Network or `5xx` failure: show the existing retryable profile/backend error state instead of treating the session as invalid.

This avoids login-page flashes while the cookie is being checked.

### Logout

`POST /api/v1/auth/logout` clears the cookie using the same name and path. Normal logout does not call `revokeRefreshTokens`, because that would sign the account out on every device. Administrative global revocation is outside this change.

## HTTP contract

### `GET /api/v1/auth/csrf`

Public endpoint that initializes Spring Security's CSRF cookie and returns the same token in JSON:

```json
{ "token": "..." }
```

The frontend stores this value in memory and sends it as `X-XSRF-TOKEN` on unsafe methods.

### `POST /api/v1/auth/session`

Request:

```json
{ "idToken": "<fresh Firebase ID token>" }
```

Response: `200 OK` with the existing profile representation and a `Set-Cookie` header. Invalid, expired, revoked, or stale-login tokens return `401` with a stable error code.

### `POST /api/v1/auth/logout`

Response: `204 No Content` and an expired session cookie.

### Existing protected APIs

Paths and response shapes do not change. They use the session cookie instead of `Authorization: Bearer ...`.

## Cookie policy

The cookie is host-only; no `Domain` attribute is set.

| Setting | Production | Local development |
| --- | --- | --- |
| Name | `session` | `session` |
| HttpOnly | `true` | `true` |
| Secure | `true` | `false` |
| SameSite | `Lax` | `Lax` |
| Path | `/` | `/` |
| Max-Age | 7 days | 7 days |

`Secure` is controlled by an environment-backed application property. Production defaults must not silently disable it.

## CSRF and CORS

Cookie authentication requires CSRF protection. Spring Security will use a cookie-backed CSRF token with the expected `X-XSRF-TOKEN` request header. The CSRF cookie is readable because it contains no authentication credential; the session cookie remains HttpOnly.

CORS is configured centrally in `SecurityConfig`:

- Allow credentials.
- Allow only explicit trusted origins/patterns, including `http://localhost:5173`, `https://capytoeic.id.vn`, and `https://www.capytoeic.id.vn`.
- Allow `X-XSRF-TOKEN` in addition to existing headers.
- Never use `allowedOrigins("*")` or an equivalent wildcard with credentials.

Controller-level `@CrossOrigin` declarations are removed so that they cannot diverge from the security configuration.

Unsafe requests must have a valid CSRF token. CORS is not treated as a replacement for CSRF protection.

## Frontend behavior

- `apiFetch` no longer reads `auth.currentUser`, calls `getIdToken`, or sets an Authorization header.
- All API requests include credentials.
- Before unsafe methods, `apiFetch` obtains or reuses an in-memory CSRF token and adds `X-XSRF-TOKEN`.
- A `401` clears the local React authentication state and routes the user to login through existing protected-route behavior.
- Network errors during autosave remain network errors and must not be converted into logout.
- Login pages exchange the temporary ID token for the backend session before navigation.
- Logout calls the backend first, then clears any temporary Firebase client state.
- Direct legacy calls in `PracticePart.jsx` are migrated to the shared API client so no protected request bypasses cookie and CSRF handling.

## Session expiration and exam safety

The session has a fixed seven-day lifetime and does not silently slide. Firebase session cookies cannot be refreshed; after expiration the user signs in again.

When a session expires during an exam, the frontend must distinguish the `401` from network failures. It keeps current in-memory answers, stops authenticated writes, and sends the user through login. Server-side attempt deadlines, persisted answers, locking, and idempotent submission remain authoritative and unchanged.

## Configuration

Backend properties:

- `app.auth.session-cookie-name=session`
- `app.auth.session-duration=7d`
- `app.auth.cookie-secure=${AUTH_COOKIE_SECURE:true}`
- `app.auth.cookie-same-site=Lax`

The local development profile or local environment must set `AUTH_COOKIE_SECURE=false`. Render production leaves it true.

Frontend production configuration:

- `VITE_API_BASE_URL=https://api.capytoeic.id.vn`

## Render custom-domain procedure

1. Open the backend Web Service in Render.
2. In **Settings → Custom Domains**, add `api.capytoeic.id.vn`.
3. At the DNS provider for `capytoeic.id.vn`, add the CNAME record Render displays. For a normal subdomain this will point host `api` to the backend service's `onrender.com` hostname.
4. Remove a conflicting `AAAA` record for the `api` hostname if one exists.
5. Return to Render and click **Verify**.
6. Wait for Render to issue the TLS certificate, then verify `https://api.capytoeic.id.vn/api/health`.
7. Set the frontend deployment's `VITE_API_BASE_URL` and redeploy it.

The existing Render subdomain may remain enabled during rollout. It should not be used by the production frontend after the custom domain is verified.

## Error handling

- Missing/invalid session cookie: `401 AUTHENTICATION_REQUIRED`.
- Invalid login ID token or stale `auth_time`: `401` with a stable authentication error code.
- Missing/invalid CSRF token: `403` with a stable CSRF error code where Spring's handler permits.
- Firebase or backend outage during session creation: `503` or the existing server error envelope; no cookie is created.
- Cookie clearing is idempotent.

Tokens, cookies, private profile data, and Firebase credential payloads must not be logged.

## Testing and rollout

Backend tests cover cookie attributes, fresh-token validation, session verification, revoked/expired sessions, logout clearing, CSRF rejection/acceptance, CORS credentials, and unchanged role authorization.

Frontend tests cover session bootstrap, login exchange, credentialed requests, CSRF headers, logout, `401` handling, and network-error behavior. Required checks are:

```text
cd backend && ./mvnw test
cd frontend && npm run lint && npm test && npm run build
```

Rollout order:

1. Configure and verify `api.capytoeic.id.vn`.
2. Deploy the backend session-cookie implementation.
3. Deploy the frontend session-cookie implementation with the custom API URL.
4. Verify Google login, staff login, role enforcement, profile loading, attempt creation, autosave, submission, and logout on production.

Existing browser sessions will need to sign in once after migration. No Firestore schema migration is required.
