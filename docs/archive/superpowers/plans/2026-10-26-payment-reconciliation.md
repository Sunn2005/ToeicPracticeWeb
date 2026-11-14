# Recover Pro payments missed by webhook

## Scope and design

PayOS may have received money before a webhook URL was registered or while the
backend was unavailable. Keep automatic webhook activation and all existing read
APIs. Add an explicit, authenticated, CSRF-protected admin recovery action.

- `POST /api/admin/payments/orders/{orderCode}/reconcile`, no request body.
- Read the locally stored order and query PayOS server-to-server using backend
  credentials (`GET /v2/payment-requests/{orderCode}`). Validate response status,
  exact order code, payment link ID, expected amount, received amount, and zero
  remaining balance before applying a PAID confirmation.
- Reject cancelled local orders, unpaid remote orders and mismatched data with
  stable 409 codes. Provider/network failures are 502 and never grant access.
- Reuse the webhook's atomic PAID transition and stored absolute Pro expiry.
  First activation starts at recovery time (or tops up remaining Pro time).
  Retry preserves the expiry and never restores a later admin revocation.
- Admin detail dialog offers recovery for pending/paid orders, displays progress,
  stable error feedback and the resulting order. Refresh the filtered list.
  Existing GET response shapes and Firestore schema remain unchanged.
- No real payment, production data mutation, deployment or credential changes
  during implementation. Preserve pre-existing ProPlan relocation/import edits.

## Implementation and verification

1. Add tested PayOS lookup with bounded timeout and safe error mapping.
2. Share paid-order application between reconciliation and webhook. Guard
   duplicate application and revocation inside the subscription transaction.
3. Add admin endpoint with method security; verify role and existing CSRF rules.
4. Add UI action, EN/VI translations, API wrapper and regression tests.
5. Update API/frontend contracts, run backend tests and frontend lint/test/build,
   review diff and document deployment/recovery steps.

## Required regression cases

Verified paid recovery, pending/partial/cancelled/mismatched responses, unknown
orders, PayOS timeout or malformed responses, repeat reconciliation, webhook
before/after reconciliation, retry after interrupted activation, admin revocation,
concurrent application, non-admin/anonymous denial and CSRF enforcement.

## Result

- Implemented on `codex/payment-reconciliation`; existing ProPlan move preserved.
- `cd backend && ./mvnw test -q`: 291 tests, no failures/errors/skips.
- `cd frontend && npm run lint && npm test && npm run build`: passed; 123 tests.
  Vite retains its large-bundle advisory; no dependency/config changes were made.
- Reviewed diff and whitespace checks. Provider calls in tests were mocked; no
  real payment order or subscription was modified and no deployment was made.
- Live authenticated UI verification remains a deployment/local-runtime check;
  the currently open localhost:8080 tab belongs to a different application.
