# Employee collection followed by Admin receipt review

The shared Collections & Installments page previously exposed the payment-recording modal to Admins. Admin now reviews actual employee-recorded receipts. Employee collection, allocation, loan credit, receipt, and settlement services are unchanged.

## Behavior
- No attributable employee receipt: Awaiting Employee Collection; clicking explains that the employee has not recorded the payment.
- A genuine employee receipt: Verify Payment opens its amount, installment allocation, actual receipt date, system entry date, and receipt/history link.
- Verified: reviewer and review time are shown. This verifies only the recorded receipt, not company funds or settlement.
- Partially paid installments retain their remaining amount after review. Each later receipt needs its own review.
- A single advance receipt covering several installments has one shared review, displayed across its allocations.
- Historical entries without employee provenance show Review Payment History and cannot be silently converted into employee receipts.
- Existing notification SSE invalidates the Admin list. A 15-second refresh and window-focus refresh provide fallback when notifications are disabled or disconnected.

## Additive persistence and security
CustomerPaymentReview is a new collection with a unique collectionId, Admin reviewer, VERIFIED status and timestamp. A transaction writes the review and CUSTOMER_PAYMENT_VERIFIED audit together. Concurrent retries return the existing review. No Collection, Loan, LoanSchedule, CollectionPosition, CashBook or EmployeeSettlement documents are written by verification. JWT and active-Admin authorization are required. An employee cannot verify a receipt. The new audit event is delivered through the existing deduplicated notification inbox.

GET /api/v1/collections/installments/:scheduleId/payment-reviews — Admin review detail.
POST /api/v1/collections/receipt/:collectionId/verify — Admin verifies an existing employee receipt; accepts no financial amounts or dates.
GET /api/v1/collections/installments — Admin-only additive customerPaymentReview summary.
GET /api/v1/collections/receipt/:collectionId — additive customerPaymentReview metadata; existing company funds verification and settlement fields remain independent.

## Files changed
- backend/src/models/CustomerPaymentReview.js (new)
- backend/src/services/customerPaymentReview.service.js (new)
- backend/src/services/collection.service.js
- backend/src/services/inbox.service.js
- backend/src/routes/collection.routes.js
- backend/tests/integration/customerPaymentReview.integration.test.js (new)
- frontend/src/components/collections/PaymentReviewModal.jsx (new)
- frontend/src/pages/employee/TodayCollections.jsx
- frontend/src/pages/employee/Receipt.jsx
- frontend/src/components/NotificationBell.jsx

## Verification performed on 27 October 2026
- Full backend: 25 suites, 201 tests passed with configured coverage thresholds.
- Frontend: 21 tests passed; ESLint and Vite production build passed. Build saved under tmp/payment-review-acceptance-build to preserve existing dist changes.
- New regression tests cover pre-collection blocking, JWT and Employee authorization, partial balances, subsequent receipts, advance allocations, concurrent retries, one audit per receipt, backdated dates, and rejection of Admin-recorded provenance. Financial-document snapshots remain identical before and after review.
- Browser: isolated MongoDB replica set on port 5010, frontend 5180, synthetic users and customer only. Tested Employee login and Collect Payment, actual partial receipt, Admin automatic update, review, Verified reopening and unchanged partial balance. No real Atlas test transactions were created.
- Browser viewports: 320x740, 375x812, 768x1024, 1440x900. Dialog fit checked; narrow-screen Close wrapping fixed. Mobile list actions are 44px. Console errors: none.
- No real Android hardware was tested.
- Updated normal backend started successfully with Atlas, port 5000; unauthenticated review endpoint returns 401.
- Screenshots: docs/screenshots/payment-review/mobile-verified.png and desktop-verified.png.

## Browser acceptance steps
1. Open Admin > Collections & Installments and choose the relevant Today, Overdue, Upcoming or All Installments filter.
2. Before Employee collection, tap Awaiting Employee Collection and confirm the explanatory message.
3. In the assigned Employee portal, record an actual customer receipt using existing Collect Payment. Retain its receipt.
4. Return to Admin; the row refreshes automatically. Open Verify Payment, inspect its actual received date and allocated amount, then verify the receipt.
5. Reopen Verified to inspect reviewer/time and follow View receipt and allocation history.
6. For a partial receipt, confirm Partially Paid and remaining balance remain correct. A later real payment produces a new review requirement.
7. Review company custody and employee settlement separately in Daily Reconciliation. Customer receipt verification alone does not establish that money reached the company.

The implementation does not migrate or edit historical financial records. Existing uncommitted work was preserved.
