# Confirm Pro activation after returning from PayOS

## Cause and design

The owner status GET verifies PayOS but never applies a paid order. The result
page therefore reports success and reloads an unchanged profile if the webhook
has not arrived (including when PayOS cannot reach localhost).

1. Keep GET read-only. Add authenticated, CSRF-protected
   `POST /api/payments/orders/{orderCode}/confirm` with no body. Check ownership
   before provider access; verify order identity, link and full amount using the
   existing server lookup. Apply PAID through the existing idempotent activation
   path, including recovery after interrupted activation. Return the existing
   order-state shape; pending/cancelled states never grant Pro.
2. On the result page, call confirmation, await profile refresh after PAID, and
   poll pending/processing at three-second intervals for at most ten calls.
   Cancel polling on navigation; allow manual recheck after errors or timeout.
   Never trust redirect query status or change the user's role.
3. Add regression tests for owner-only activation without webhook, repeated
   confirmation/webhook, interrupted activation, provider failures/mismatch,
   unpaid states, authentication and CSRF. Update API docs and EN/VI copy.
4. Run backend tests and frontend lint/test/build; review diff. No dependency,
   schema, credential, live payment or production data changes.

## Verification

- Backend: 332 tests passed, no failures/errors/skips.
- Frontend: lint, 126 tests and production build passed; existing bundle-size advisory remains.
- Reviewed diff and whitespace. Local frontend configuration targets localhost;
  webhook is configured to deploy per the user. No live account or payment was
  changed during verification. Restart the local backend and revisit the result
  URL with the existing orderCode to confirm the previously paid order.
