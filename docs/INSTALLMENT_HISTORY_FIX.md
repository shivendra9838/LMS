# Installment payment history fix

Completed 27 October 2026.

## Root cause

Collections & Installments rendered History unconditionally on every installment. Its click handler navigated to `/loans/:loanId?tab=history`, which correctly displayed the complete loan's collections, but was incorrectly presented as the selected installment's history. The installment list did not provide allocation-derived history availability for the Employee portal.

The existing Admin payment-review service already identified receipts by matching allocation schedule ID and loan ID. That logic is now reused for both portals' read-only installment history.

## Changes

- Installment lists now return `hasPaymentHistory`, `paymentAllocationCount` and `allocatedPaidAmount`, derived from positive recorded receipt allocations rather than just a loan balance or paid status.
- History is hidden when that specific installment has no allocated receipt. Unpaid Employee installments retain their existing eligible Collect Payment action. Admin's existing Awaiting Employee Collection / Verify Payment behavior remains separate.
- New authenticated `GET /api/v1/collections/installments/:scheduleId/history` returns only receipts allocated to that installment, its paid amount and remaining balance. Admin access and current Employee loan-assignment ownership are enforced. Invalid IDs and unauthorized access are rejected.
- The shared payment dialog has a read-only history mode for both portals. It shows the amount allocated to this installment prominently, the original full receipt amount separately, actual receipt date, installment due date, entry timestamp, timing and any existing verification details.
- A receipt covering several installments appears once in each affected installment's history with only that installment's allocation. Partial payment history retains the correct remaining balance.
- Existing legacy direct receipts without an allocation array remain limited to their exact recorded schedule reference using the existing payment-review attribution logic. No future allocations are invented and no legacy records are rewritten.
- Original receipts and full loan-level Collection History remain accessible. Advance payments, backdated entries, receipt review, company settlement verification and financial posting calculations are unchanged.

## Files

Updated:

- `backend/src/services/customerPaymentReview.service.js`
- `backend/src/services/collection.service.js`
- `backend/src/routes/collection.routes.js`
- `backend/tests/integration/customerPaymentReview.integration.test.js`
- `frontend/src/pages/employee/TodayCollections.jsx` (shared Admin/Employee collection page)
- `frontend/src/components/collections/PaymentReviewModal.jsx`

Created:

- `frontend/src/components/collections/InstallmentActions.jsx`
- `frontend/tests/installmentHistory.test.mjs`
- This report and screenshots under `docs/screenshots/installment-history/`.

## Configured database verification

Read-only inspection of `loan_management` confirmed LN000001 has one matching receipt of 700 INR received on 26 October 2026, with a single 700 INR allocation to Day 1. Days 2-30 have zero paid.

Both corrected service checks and authenticated live HTTP checks after restarting the local backend confirmed:

- Admin: Day 1 history available, allocated amount 700 INR, payment business date 2026-10-26; 29 later unpaid installments have no history; Day 2 history returns an empty payment list.
- Employee: identical results for the assigned loan.
- A before/after digest of Collections, Loans, LoanSchedules, CollectionPositions, CashBooks and EmployeeSettlements remained identical during verification.

No configured database payments, allocations, loans, balances, settlements or historical financial records were modified or deleted. No test data was inserted into the configured database. Test writes used disposable local MongoDB replica sets only. Existing uncommitted work was preserved.

## Executed checks

| Check | Result |
| --- | --- |
| All backend tests, with configured coverage checks | PASS: 227 tests, 29 suites |
| Frontend tests | PASS: 37 tests, including four new history UI regressions |
| Frontend ESLint | PASS |
| Frontend production build | PASS: output in `tmp/installment-history-build` |
| Day 1 paid, Days 2-30 unpaid | PASS in both API roles and isolated browser workflows |
| Partial and advance allocations | PASS: a 1,650 INR receipt allocated 700 / 700 / 250; Day 3 history shows 250 paid, 450 remaining, and the full receipt separately |
| Multiple receipts on a partially paid installment | PASS: only that installment's allocations appear and the remaining balance reaches zero after the real remainder is recorded in isolated tests |
| Backdated dates, receipts, full loan history | PASS |
| Authentication, other Employee access, invalid/nonexistent IDs | PASS |
| Financial record preservation during read-only history requests | PASS |
| Browser console errors | None recorded in the isolated verification session |
| Responsive history dialog | PASS at 320, 375, 390, 430, 768, 1366, 1920px: no horizontal document/modal overflow and tested dialog actions at least 44px high |

Browser interactions verified Employee mobile history, partial allocation history, the original receipt link, full loan Collection History, and Admin desktop actions/history. Synthetic screenshots are included; no real customer information was captured. Real Android hardware was not tested.

## Runtime and manual verification

The local backend was restarted with existing configuration and is running on port 5000. Live endpoint checks passed after startup. The main frontend is running at `http://127.0.0.1:5173`; isolated preview servers are no longer listening on ports 5010 or 5180.

1. Refresh the main website.
2. Employee → Collections → choose All Installments → search LN000001.
3. Day 1 should show History with 700 INR received on 26/10/2026 and zero remaining.
4. Days 2-30 should have no History. Collect Payment remains available only when existing collection rules allow it.
5. Repeat in Admin → Collections & Installments. Uncollected installments keep their existing Awaiting Employee Collection action.
6. My Loans → open the loan → Collection History still shows the full receipt history.

No unresolved application errors were found. Native Android touch/keyboard behavior remains a real-phone acceptance check.
