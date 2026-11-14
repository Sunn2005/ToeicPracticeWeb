# Session bootstrap recovery

## Problem

Public navigation hides login while `/api/me` is pending, and all other routes
wait indefinitely for that request. Production API requests currently time out.

## Plan

1. Bound session bootstrap to 10 seconds and abort its request on timeout,
   cancellation, unmount, or superseding login. Ignore late results.
2. Keep unavailable distinct from anonymous (only HTTP 401 means anonymous).
   Preserve cookies and existing profile on connection errors.
3. Keep public login links and login/recovery screens accessible during bootstrap.
   Show a localized retry notice on bootstrap failure; private routes render that
   recovery screen rather than private content or an anonymous redirect.
4. Prevent bootstrap results from overwriting interactive login/logout/profile
   updates. Preserve backend session/CSRF contracts and authorization.
5. Verify timeout, cancellation, late completion, retry, route guards, and both
   languages. Run frontend lint, tests, build, and review the diff.
6. Inspect production service health/logs where connected access permits it.
   Production repair/deployment remains separate from the local frontend patch.

No dependencies, API schemas, cookie settings, roles, exam behavior, or AI flow
changes are needed. User authorized the described auth/UI repair in this chat.
