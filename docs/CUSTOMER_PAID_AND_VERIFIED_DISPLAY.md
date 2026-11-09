# Customer Paid display and non-clickable Admin verification

## Cause and fix

The Collections table displayed installment paidAmount as its main payment value, so it showed ₹700 even though the contributing receipt was ₹800. It now shows Customer Paid as the actual receipt amount only on the receipt's stored starting installment. For COL000005, Day 2 shows ₹800 with Day 2 ₹700 and Day 3 advance ₹100. Day 3 shows Advance received ₹100, Source COL000005, and ₹600 remaining; it does not repeat ₹800 as an independent collection.

Multiple receipts contributing to an installment appear separately inside a compact Payment Breakdown disclosure. No sums in dashboards, exports, cashbook, settlements or loan balances were changed. Advance labels use the actual receipt/due dates; late carry-forward uses Received allocation instead of pretending it was received early. Unattributed legacy paid balances are labeled as allocations with unavailable receipt details rather than inventing a receipt amount.

The Admin action used to render a button for every review state; even its Verified label retained the onClick handler. VERIFIED now renders a green check and non-clickable text. History remains available for original verifier, Asia/Kolkata time, remarks and receipt details. The shared read-only status applies to every covered installment after one receipt review.

The existing secure backend review transaction already enforces one unique review per receipt, returns the original review on retries/concurrent duplicate-key conflicts, and creates an audit only with a new review. This behavior was retained and regression-tested. No duplicate notification-producing audit is emitted on a repeated verification.

## Existing real receipt safety

Read-only Atlas inspection confirmed COL000005 is ₹800, allocated ₹700/₹100 and already VERIFIED. Its original verifiedAt is 2026-10-28T15:47:55.350Z (21:17:55.350 Asia/Kolkata). Before/after JSON comparison confirmed the receipt amount, allocations, review ID, verifier, timestamp and remarks remain identical. No repair, reset or configured-database financial write was made.

## Files changed

- backend/src/services/customerPaymentReview.service.js — derived primary-installment and actual receipt timing metadata on existing authorized read APIs.
- frontend/src/components/collections/CustomerPaid.jsx — shared receipt-origin/advance presentation for Admin and Employee.
- frontend/src/components/collections/InstallmentActions.jsx — green non-clickable Verified status; retain read-only History.
- frontend/src/pages/employee/TodayCollections.jsx — shared table/mobile cards, simplified headings, Customer Paid component. Admin reuses this screen.
- backend/tests/integration/customerPaymentReview.integration.test.js — origin/source allocations, repeat-review immutability and cross-installment persisted status.
- frontend/tests/installmentHistory.test.mjs — full receipt versus advance, multiple receipt breakdown and non-clickable Verified regression coverage.

## Executed checks

Backend full suite: 35 suites / 290 tests passed. Final timing-projection targeted rerun: 22 tests passed. Frontend: 73 tests passed. ESLint and production build passed; build output was directed to tmp/customer-paid/build-final to preserve existing tracked dist files.

Disposable MongoMemory replica-set browser checks:

- Admin login and All Installments show source ₹800 with ₹700/₹100 breakdown; Day 3 shows only its ₹100 advance and ₹600 remaining.
- Verify synthetic receipt once; both covered installment actions become plain Verified text with a green check, with zero Verified buttons in the page.
- Reload, logout and re-login preserve Verified; History shows original saved verifier/time.
- Employee login shows identical receipt/advance values and synchronized history verification; next payment form shows ₹100 already adjusted and ₹600 remaining.
- Both portals measured at 320, 375, 390, 768, 1024 and 1366 CSS pixels without document overflow; mobile screenshots visually inspected. This is browser emulation, not real-phone testing.
- All synthetic records remained in the disposable database. Temporary API/frontend/MongoDB processes stopped after testing.

Existing tests cover exact, extra, multi-installment, partial, backdated payments, idempotency, permissions, cashbook/custody totals and review without financial posting. No customer-payment reversal endpoint exists; true reversal is NOT VERIFIED. Prior isolated reopened-balance tests remain passing. No receipt/PDF generator or print styles were changed; saved PDF/physical printing was not re-verified in this change.

## Manual acceptance

Refresh http://localhost:5173. Admin → Collections & Installments → All Installments → LN000001: Day 2 should show Customer Paid ₹800, breakdown ₹700 for Day 2 / ₹100 advance for Day 3, remaining ₹0 and a non-clickable green Verified status. Day 3 should show Advance received ₹100, source COL000005 and ₹600 remaining. History should retain the original Admin/time. Employee → Collections → All Installments must match; open Collect Payment to confirm ₹600 remaining, then cancel unless money was genuinely received.

Logs, read-only comparisons and screenshots: tmp/customer-paid/.
