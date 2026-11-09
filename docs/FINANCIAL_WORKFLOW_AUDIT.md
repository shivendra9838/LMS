# Financial workflow audit — 23 October 2026

Implemented against the existing React/Express/MongoDB application. Financial tests use a disposable MongoDB replica set. Browser tests use an isolated preview application and synthetic accounts. No test financial records were created in the configured database.

## LN000005: actual database findings

- Principal ₹20,000; flat interest ₹1,000; contracted total ₹21,000; 30 installments of ₹700.
- All 30 stored installments are unpaid. Recorded loan paid amount, schedule paid amount and payment ledger total are all zero. Checks for collections linked through schedules or the same customer did not reveal misplaced payments.
- Assigned employee exists, is active, and matches the customer's assignment.
- Stored maturity is `2026-08-28T00:00:00.000Z`, or **28 August 2026 in India**. A browser in an American time zone could display 27 August. No stored date was changed.
- Previously, Employee collections selected only installments dated today. Admin missed payments depended on stored notifications rather than unpaid schedules. The database had no such notifications. Matured unpaid debt therefore disappeared from both views.
- After restarting the configured backend, authenticated read-only API checks returned HTTP 200, `effectiveStatus: OVERDUE`, overdue amount ₹21,000, 30 overdue installments, `canCollect: true`, and 30 Admin overdue rows. Stored status remains ACTIVE, preserving the existing enum.
- Settlement funds remain zero until an actual customer payment is received. Debt itself is not settlement custody and must never become a fabricated receipt.

## Corrections

All business-day boundaries now use Asia/Kolkata. Employee collection lists include unpaid installments through today, including arrears after maturity. Admin arrears are derived directly from outstanding schedules, independent of cron execution or notification history. The scheduled overdue monitor is read-only and no longer creates automatic historical missed-payment entries.

New loans calculate money in paise, reconcile the final installment to the contracted total, and preserve the existing next-day first-installment policy. Issuance, schedules, disbursement cashbook and audit entries are transactional. Concurrent issuance and loan-number allocation are protected. Customer approval and employee assignment are validated.

Payments reject overpayments and inconsistent allocations, allocate extra receipts across other unpaid installments, count fully paid schedule rows correctly, and preserve idempotency and custody classification. Old unpaid DEFAULTED loans remain recoverable. Loan completion/closure requires zero unpaid debt; arbitrary cancellation is rejected because it needs a separate disbursement-reversal process. Loan timeline access checks ownership.

Dashboards and reports distinguish money actually received today from installments due today. Employee ObjectId filters, receipt-date aggregation, report filters, exports and fresh totals were corrected. Cashbook date reads reuse legacy midnight records without moving historical entries. Existing settlement reservations, disputes, approval/rejection and source/destination authorization remain enforced.

Employee screens now show overdue balances, collection filters, India dates, payment history navigation and clearer extra-payment messages. Existing Royal Enterprises branding and responsive navigation are retained.

## Changed code

- New backend utilities/services: `src/utils/businessDay.js`, `src/services/overdue.service.js`, `src/repositories/financialReportData.js`, `src/services/scheduleRepair.service.js`.
- Updated backend: loan calculator, loan-number generation, loan service/controller/validator, collection service/repository, dashboard/report repositories, notification service, overdue cron, cashbook/expense date handling, settlement index initialization.
- New regression tests: `tests/integration/financialWorkflow.integration.test.js`, `tests/unit/businessDay.test.js`; related compatibility assertions retained.
- New repair CLI: `backend/scripts/financial-schedule-repair.js`.
- Frontend: `LoanDetailsView`, `StatusBadge`, `RecordPaymentModal`, Admin Dashboard/Loans/MissedPayments, Employee Dashboard/AddLoan/TodayCollections/Receipt, shared DailySettlement, and new `utils/businessDate.js`.
- Earlier uncommitted KYC, session, settlement, branding and responsive changes were preserved.

## Historical rounding repair: review required

LN000003 has a ₹0.05 schedule shortfall: contracted total ₹2,060 versus schedule total ₹2,059.95. Loan, ledger and schedule paid amounts otherwise reconcile. No repair was applied. A dry-run plan proposes changing only its unpaid final installment from ₹137.33 to ₹137.38. The UI flags a financial review requirement.

From the repository root, generate a fresh reviewable plan:

```powershell
node backend/scripts/financial-schedule-repair.js --loan LN000003 --out tmp/financial-audit/repair-plan-LN000003.json
```

Only after reviewing the plan and backing up the database, an operator may explicitly apply it using an existing active Admin's database ID:

```powershell
node backend/scripts/financial-schedule-repair.js --apply tmp/financial-audit/repair-plan-LN000003.json --admin-id <ACTIVE_ADMIN_ID>
```

The procedure checks snapshot hashes, locks the loan within a transaction, changes only an eligible unpaid final installment and appends an audit record. It returns the repair audit ID. It does not change payments, custody, dates or contracted loan balances. Stale or tampered plans fail. To reverse before further payment activity:

```powershell
node backend/scripts/financial-schedule-repair.js --rollback <REPAIR_AUDIT_ID> --admin-id <ACTIVE_ADMIN_ID>
```

Reversal appends its own audit entry; changed financial activity prevents automatic reversal. MongoDB transaction support is required. Do not run apply/rollback commands merely to test them on live data; both were tested in the disposable database.

## Executed verification

- Backend: **143 tests passed, 18 suites**. Includes KYC, authorization, receiving accounts, password recovery, finance compatibility, collection/settlement flows and the new financial regression cases.
- Financial cases include zero-payment matured loans, partially paid matured loans, exact final rounding, full completion, duplicate receipt retries, overpayment rollback, concurrent issuance, cash/employee UPI/employee bank/company-direct custody, settlement approval/rejection/retry/disputes, unauthorized access, report filters, Excel/PDF output, India midnight boundaries, and safe repair/rollback/stale-plan rejection.
- Frontend: **11 tests passed**, ESLint passed and production build passed. Production build was written outside the existing tracked dist folder to preserve prior work.
- Browser: synthetic matured ₹21,000 loan appeared as overdue. Employee recorded ₹200 cash and ₹500 employee-received UPI; receipts and remaining dues updated. Settlement displayed ₹200 cash and ₹500 digital separately. Admin saw the remaining 29 overdue installments and verified a ₹150 cash settlement; Employee status refreshed to VERIFIED.
- Browser layout widths: **320, 375, 390, 430, 768, 1024, 1366px**, with no document-level horizontal overflow on the collection page. Payment dialog opened/closed at 390px without horizontal overflow.
- Live database: before/after SHA-256 fingerprints and counts matched for loans, schedules, collections, cashbooks, custody positions, settlements and payment accounts. No financial data repair, reset or deletion was executed.
- Logs and synthetic screenshots: `tmp/financial-audit/`. These ignored local files are not application dependencies.

## Browser acceptance checks

1. Refresh the local app at http://localhost:5173 and sign in as the assigned Employee.
2. Dashboard → overdue balance → Today's Collections → Today and overdue (or Overdue only). Find LN000005. Its unpaid installments must remain collectable after maturity.
3. Record only a genuinely received customer payment. Confirm method, receiving account, amount, receipt and loan history.
4. Daily Settlement → select eligible custody funds and an active compatible company destination. Cash, employee-held digital and company-direct receipts must remain distinct.
5. Admin → Daily Reconciliation → review evidence and approve/reject. Refresh Employee settlement status. Admin → Missed Payments shows remaining arrears without waiting for cron.
6. Compare daily received totals using India dates, and test filtered report exports.

Real Android hardware, camera/file picker, physical printing and native PDF handling were not tested in this audit. Responsive browser checks covered the collection page and payment dialog, not every route at every width. Gmail reset delivery still needs its separate sender/App Password configuration if not already completed. No existing payment was reclassified automatically, and no external bank balance was independently reconciled.
