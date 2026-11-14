# Payment cancellation and retry

1. Verify provider identity and amount before reusing any pending checkout, regardless of local age. Reuse payable PENDING links; block PROCESSING/PAID; atomically close provider-confirmed CANCELLED/EXPIRED orders. Fail closed on provider errors.
2. Add owner-only GET order status and POST retry endpoints. Retry derives the plan from the stored order and verifies provider state again. Preserve webhook activation and idempotency; no trust in redirect status.
3. Show verified state, loading/errors and retry on the payment result page. Missing order code falls back to pricing. Add EN/VI copy.
4. Cover cancellation, retry, ownership, mismatch, unavailable, processing and paid cases; run backend tests and frontend lint/test/build; review diff.

No dependencies, exam or AI changes. EXPIRED is mapped to existing CANCELLED locally; no schema change. Provider-verified pending links remain reusable after 15 minutes to avoid duplicate payable orders.
