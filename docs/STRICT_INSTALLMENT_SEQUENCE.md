# Strict sequential installment collection

## Cause and fix

The previous payment service credited the selected installment first, then distributed excess across other unpaid installments. It did not check whether an earlier installment still had a balance. The list API independently enabled collection on every unpaid installment. A future row could therefore be selected directly, ahead of older debt.

The new rule is enforced inside the existing MongoDB payment transaction: **the selected installment must be the lowest installment number with an actual unpaid balance in that loan**. It is not determined from the displayed PAID/PARTIAL label, employee/customer order, date filter or current page.

- Day 1–2 paid, Day 3 unpaid: Day 3 Collect Payment; Days 4–30 Locked.
- Day 3 receives ₹300 of ₹700: Day 3 stays collectible for ₹400; later days stay locked.
- Completing the remaining ₹400 unlocks Day 4.
- ₹1,000 starting at Day 3 allocates ₹700 to Day 3 and ₹300 to Day 4. Day 4 remains the next collectible installment, with ₹400 left.
- ₹1,400 clears both Days 3 and 4 and unlocks Day 5.

Selecting a later row is rejected with HTTP 409, for example `Cannot collect Day 5. Day 3 has ₹700.00 remaining.` No collection, custody, cashbook or loan-credit writes survive rejection. Existing idempotent retries are resolved before sequence validation, so retrying a successful payment still returns its original receipt even after that installment is paid.

## Existing rules preserved

- Multi-installment advance payments were already allowed by the backend, up to the recorded outstanding loan balance. That existing limit is preserved. Only the starting installment is now restricted.
- Excess money is allocated to subsequent unpaid installments in installment-number order. No fees, interest, principal, schedule amounts or loan-total calculations were changed.
- Backdated received dates and mandatory reasons still use existing validation. Future received dates and amounts above the loan outstanding remain rejected.
- Employee ownership, active loan/account checks, destination permissions, transactions, idempotency, custody and audit logging remain in the existing payment service.
- Admin Collections remains a receipt-review screen. No Admin Collect Payment button or new collection permission was introduced. Existing authorized Admin API entries must obey the same sequence rule.
- Admin may still review a genuine historical receipt even if that installment becomes locked after an earlier balance is reopened. Reviewing a receipt does not pay an installment or verify employee-to-company settlement.
- Existing missed markers are non-money records and do not unlock installments; their established behavior is retained.
- History visibility, allocation-specific history, full loan history, actual received dates, entry timestamps, receipts and PDF rendering are unchanged.
- No existing database records were reset, migrated, repaired or reordered. Historical out-of-sequence payments remain untouched.

## APIs and UI

Existing installment APIs now include additive fields:

- `canCollect`: true only for the actual earliest unpaid installment on a collectible loan.
- `collectionLocked`, `collectionLockReason`.
- `nextCollectibleScheduleId`, `nextCollectibleDayNumber`, `nextCollectibleRemainingAmount`.

The sequence lookup searches the entire same loan using its existing loan/installment-number index, even when the earlier installment is outside Today, Overdue, Upcoming, a customer filter, search results or the current page. For paginated lists the lookup runs after the page limit. Existing result counts and balance summaries remain unchanged.

New protected read-only endpoint:

`GET /api/v1/collections/installments/:scheduleId/allocation-preview?amount=1000`

It returns the actual planned installment IDs/numbers, due dates, allocated amounts and balances remaining after allocation. It checks authentication, loan ownership, loan eligibility, sequence and amount. Responses use `Cache-Control: no-store`. The preview reserves no funds and writes no financial records; all checks are repeated by the transaction when saving.

The shared Employee payment form shows this preview and keeps Record Payment disabled until a valid preview is available. Retry preserves the entered amount. An edited amount or refreshed installment balance requires a new preview. Stale quotes cannot authorize a payment against a newly locked installment.

Both mobile cards and desktop tables show a disabled **Locked** button and a visible explanatory message. Pending locked rows retain pending/overdue colors rather than looking paid. Admin customer installment cards also show the lock explanation. My Loans' existing View All Installments navigation uses the same protected collection list.

Both portals use the existing notification/focus refresh mechanism and a visible-page 15-second refresh. Background refresh retains current rows, scroll position and open form state. Changing scope/page/search shows a loading state until the new query returns, preventing stale rows from appearing under a different filter.

## Changed files

New backend files:

- `backend/src/utils/installmentSequence.js`
- `backend/src/services/collectionAllocationPreview.service.js`
- `backend/tests/integration/sequentialCollections.integration.test.js`

Backend updates:

- `backend/src/services/collection.service.js` — transaction guard, actual-balance eligibility and forward-only excess allocation.
- `backend/src/repositories/collection.repository.js` — same-loan sequence metadata, independent of filters/pagination.
- `backend/src/routes/collection.routes.js` — protected allocation preview.

Frontend updates:

- `frontend/src/components/collections/InstallmentActions.jsx`
- `frontend/src/components/collections/RecordPaymentModal.jsx`
- `frontend/src/pages/employee/TodayCollections.jsx` (shared Admin/Employee list)
- `frontend/src/pages/admin/CustomerDetails.jsx`

New frontend regression tests: `frontend/tests/installmentSequence.test.mjs`.

Existing test fixtures updated to follow the requested policy:

- `backend/tests/integration/followUps.integration.test.js` now rejects the old future-day shortcut and verifies an advance that starts at the oldest unpaid day.
- `backend/tests/integration/settlement.integration.test.js` now selects the earliest unpaid installment when creating custody test receipts, including legacy and concurrency cases. Existing monetary, verification, evidence, export and reconciliation assertions are retained.
- `backend/tests/integration/financialWorkflow.integration.test.js` now explicitly rejects selecting the last installment ahead of debt, then pays from the earliest remaining installment. Its paid totals, paid-day count, overdue, history and rollback assertions remain in place.

Documentation: this report and screenshots under `docs/screenshots/installment-sequence/`. Existing uncommitted work was preserved.

## Tests executed

- **259 backend tests / 32 suites passed**, including the 9 new sequence integration tests. Existing coverage thresholds passed.
- **49 frontend tests passed**, including 4 new sequence regressions.
- **Frontend lint passed.**
- **Production build passed**, using `tmp/installment-sequence-final-build` to preserve existing `frontend/dist` work.

The initial full run exposed old fixtures that intentionally jumped to arbitrary later installments. Those were updated as described above; the affected settlement/financial suites then passed (41 tests), followed by the passing complete suite. No test was removed, skipped or weakened to allow a sequence bypass.

Coverage includes all scopes and pagination, partial/full completion, ₹1,000/₹1,400 allocations, preview-to-receipt consistency, direct Employee/Admin/legacy API rejection, ownership, idempotent and concurrent requests, advance/backdated/future dates, overpayment rollback, false PAID labels, separate loans, allocation-specific histories and receipts, and stale preview rejection after a reopened balance.

No customer-payment reversal API exists in this repository. A corrected/reopened balance was simulated only inside the disposable integration database to verify that locks recalculate from the current actual balance. This change does not introduce or claim a new audited financial reversal workflow.

Logs:

- `tmp/installment-sequence/backend-final-tests.txt`
- `tmp/installment-sequence/frontend-tests.txt`
- `tmp/installment-sequence/frontend-lint.txt`
- `tmp/installment-sequence/frontend-build.txt`

## Browser verification

Browser testing used only `installment_sequence_browser_disposable`, a separate MongoMemoryReplSet database. No synthetic customers, payments or users were written to the configured Atlas database.

Executed through the actual UI:

1. Employee and Admin login using isolated accounts.
2. Day 1–2 already covered; one Collect Payment action for Day 3 and 27 disabled later installments.
3. Employee records ₹300 after reviewing the server preview: Day 3 has ₹400 remaining and Day 4 stays locked.
4. Employee records the remaining ₹400: Day 4 unlocks automatically on returning to the list.
5. Employee previews/records ₹1,000 on Day 4: ₹700 covers Day 4; ₹300 covers Day 5; Day 5 remains partial with ₹400 outstanding and Day 6 remains locked.
6. Admin list updates automatically to show the recorded receipt. Admin has no Collect Payment action. Admin verification succeeds without unlocking Day 6 or clearing Day 5's balance.
7. Today/Overdue/Upcoming/All views and My Loans → View All Installments navigation tested. Backend tests additionally exercise an earlier unpaid day hidden outside each scope/page.
8. Employee and Admin lists checked at **320, 375, 390, 430, 768, 1024, 1366, 1920px**: no document horizontal overflow. The Employee form was also checked at 320, 375, 768 and 1366px without horizontal form overflow. Employee lock counts stayed consistent across breakpoints.
9. No browser application errors were observed in the final checks.

Screenshots visually inspected:

- `docs/screenshots/installment-sequence/employee-partial-locked-375.png`
- `docs/screenshots/installment-sequence/admin-sequential-desktop-1366.png`

Real Android/iPhone hardware and on-screen keyboard behavior were not tested; those remain manual checks. No unresolved automated test failures remain.

## How to verify locally

1. Refresh the website. Employee → Collections → All Installments, or My Loans → View all installments / collect advance.
2. On your chosen test loan, confirm only its earliest unpaid day is collectible, and later days explain the blocking day and remaining amount.
3. When you choose to enter genuine test data, pay part of that day. Confirm its balance decreases while later days remain locked.
4. Pay its remainder. Confirm the next day unlocks. A multi-installment amount must preview and allocate in order, never skip a gap.
5. Admin → Collections & Installments: confirm receipt review/history remains available and separate from Daily Reconciliation/settlement verification.
6. Check the same loan through all date filters and on a real phone. Existing historical receipts remain available; this change does not rewrite them.
