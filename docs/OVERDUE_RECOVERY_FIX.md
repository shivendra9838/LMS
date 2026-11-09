# Overdue and Today Collection Recovery

## Result and root causes

The scheduled target was measuring scheduled dues correctly, but did not prominently distinguish previous overdue balances from today's unpaid amount. The Employee Today list also filtered to today's installment, which could be correctly locked behind an older unpaid installment. The fix presents overdue and today together and opens the oldest eligible installment through the existing collection workflow. Sequential locks were retained.

Existing follow-up records did not offer structured missed reasons tied to an original installment date. Optional reason and original due-date fields now support that relationship without altering financial records or inventing legacy explanations.

## Financial definitions

Amounts use the existing integer-paise helpers and saved installment schedules. Business dates use the existing Asia/Kolkata utilities.

- Scheduled target: original scheduled amounts due on the selected date, across authorized loans.
- Previous overdue: unpaid installment balances with due dates before that date.
- Today/date unpaid: remaining balance on installments due on that date.
- Total collectible: previous overdue + date unpaid.
- Remaining collectible: the same current outstanding overdue/date-due balance after valid allocations. This is not a frozen opening-day total.
- Actual collected: valid customer receipts received on that date, counted once per receipt using existing received-date semantics.

Future installments do not increase collectible. Actual receipts are not subtracted again: they may fund overdue, current or future installments. Settlements are separate custody transfers. Historical reports retain the existing safeguards for ambiguous historical allocation evidence.

The dashboard aggregates all authorized assigned loans independently of its selected progress loan. Active-customer and due-customer counts remain supplied by the existing dashboard service; overdue installment count is also shown.

## Workflow

Employee Collections > Today groups unpaid overdue and today's installments by customer/loan. Each group preserves original due dates, scheduled, allocated and remaining amounts, last valid payment date, and follow-up notes. Overdue-only loans are included. Search and the Overdue/Upcoming/All filters remain available.

Collect Outstanding Dues opens the oldest eligible schedule row. Preview and commit continue to use the existing authoritative allocation planner, authorization, transaction and idempotency mechanisms. The form includes every outstanding overdue/today row, including rows receiving zero allocation. Existing authorized advance and backdated payment rules remain in force.

Regression example: ₹500 over three ₹181.67 dues allocates ₹181.67, ₹181.67 and ₹136.66; the third retains ₹45.01. This creates one receipt, not three receipts.

Missed reasons are separate follow-up records. Supported reasons are customer unavailable, insufficient funds, business closed, promised another date, customer refused and other. The original due date must match the loan's schedule and precede contact date; promised-date reasons require a promise date. Existing author, creation time, remarks, idempotency and audit mechanisms are retained. Original dates are canonicalized with the business-day utility. Missing legacy reasons display “Reason not recorded”.

The shared receipt shows original due dates separately from actual received dates and identifies overdue recovery, due-today and advance allocations. Current remaining overdue and today-unpaid balances are explicitly labeled as generation-time balances. Customer receipt review and company settlement remain separate. Existing loan history and allocation inspectors remain available, with links to outstanding collection and follow-up history.

## Files changed for this task

Backend:

- `backend/src/services/collectionPerformance.service.js`
- `backend/src/services/collectionRecovery.service.js` (new)
- `backend/src/routes/collection.routes.js`
- `backend/src/services/collectionAllocationPreview.service.js`
- `backend/src/models/OverdueFollowUp.js`
- `backend/src/services/followUp.service.js`
- `backend/src/services/collection.service.js`
- `backend/src/services/paymentReceiptPdf.service.js`
- `backend/tests/unit/collectionPerformance.test.js`
- `backend/tests/unit/collectionAllocation.test.js`
- `backend/tests/integration/financialWorkflow.integration.test.js`
- `backend/tests/integration/followUps.integration.test.js`

Frontend:

- `frontend/src/components/collections/RecoveryCollections.jsx` (new)
- `frontend/src/components/collections/recovery.css` (new)
- `frontend/src/pages/employee/TodayCollections.jsx`
- `frontend/src/pages/employee/Dashboard.jsx`
- `frontend/src/components/dashboard/CollectionInsights.jsx`
- `frontend/src/components/collections/InstallmentActions.jsx`
- `frontend/src/components/collections/RecordPaymentModal.jsx`
- `frontend/src/pages/shared/FollowUps.jsx`
- `frontend/src/components/receipts/PaymentReceipt.jsx`
- `frontend/src/components/loans/LoanInstallments.jsx`
- `frontend/src/components/dashboard/FinancialBreakdown.jsx`
- `frontend/tests/installmentSequence.test.mjs` (router context retained around existing assertions)
- `frontend/tests/recovery.test.mjs` (new)

API: added authenticated read-only `GET /api/v1/collections/recovery`; enriched existing preview and receipt responses. Database schema: two optional follow-up fields only; no migration, reset or repair applied. Existing uncommitted work was preserved.

## Executed validation

- Backend: **39 suites, 336 tests passed**, coverage gates enabled; final run 254.177 seconds.
- Frontend: **128 tests passed**, zero failed/skipped.
- Frontend lint: passed.
- Production build: passed; verification output in `tmp/recovery/build`.
- Disposable MongoMemoryReplSet was used for integration and browser fixtures. No synthetic financial records were written to the configured Atlas database.
- New regressions cover collectible separation, overdue-only/zero totals, exact paise allocation, recovery endpoint ownership, preview/commit results, and structured follow-up validation/idempotency without balance or payment mutation. Existing suite also exercises backdated receipts, permissions, settlement separation and duplicate submission protection.

Browser recovery scenario in the disposable database:

1. Login as Employee; original overdue ₹1,300 + today unpaid ₹700 = collectible ₹2,000. Existing actual receipts ₹800 remained separate.
2. Open oldest eligible Day 2, preview and record one ₹1,500 receipt: ₹600 to Day 2, ₹700 to Day 3 and ₹200 to Day 4.
3. Receipt displayed original installment dates, actual receipt date, unverified customer receipt and unsettled employee custody separately.
4. Dashboard and Collections updated to overdue ₹0, today unpaid/collectible ₹500, and actual receipts ₹2,300.
5. Admin login/dashboard displayed the same values, including scheduled ₹700 and allocated-to-today ₹200.
6. A further ₹1,000 preview showed ₹500 current + ₹500 future allocation; that second payment was not submitted.

Responsive checks: **60 checks** across Dashboard, Collections, payment form, loan installments, loan history and receipt, at **320, 360, 375, 390, 430, 480, 768, 1024, 1366 and 1920px**. No horizontal page overflow detected. Desktop/mobile screenshots are in `docs/screenshots/recovery`; matrix is `tmp/recovery/responsive-matrix.json`. These are browser viewport tests, not physical-device testing.

The generated synthetic receipt PDF was rendered and visually inspected: one A4 page, readable logo/text, allocation rows and balances inside margins. Native print dialogs and physical-printer output were not exercised.

Normal local backend was restarted and connected successfully to its configured MongoDB. The normal frontend remains available on port 5173. No authenticated financial test submissions, data reset or historical-record repair were sent to that configured application. A comprehensive before/after Atlas record-hash comparison was not performed in this task.

## Limits and manual acceptance

- There is no customer-receipt reversal API in the current model. A real reversal workflow and end-to-end reversal test were not introduced or claimed; existing invalid-receipt projection handling was preserved.
- Old receipts do not contain immutable overdue-at-receipt-time balance snapshots. The added balances are clearly labeled current generation-time values instead of fabricating historical balances.
- The recovery read currently loads all authorized installment rows and groups by loan. Server-side pagination may be needed for very large portfolios.
- Responsive checks cannot prove every Android keyboard, camera or printer behavior. Test the following on a real phone and desktop with your own authorized testing records.

Manual steps:

1. Open Employee > Dashboard. Compare scheduled, previous overdue, unpaid today, total collectible and actual receipts with the saved schedules.
2. Open Employee > Collections > Today. Find an overdue-only loan and expand its breakdown. Newer installment locks must still be visible in the installment view.
3. Use Collect Outstanding Dues. Check the oldest-first preview, including rows with zero allocation. Submit only an actual authorized test receipt.
4. Inspect the receipt and loan history: one receipt, distinct received/due dates, correct per-installment allocation and current remaining balances.
5. Add an overdue follow-up through Follow-ups & history. Verify original due date, author, reason and promise date; verify financial balances remain unchanged.
6. Refresh Employee and Admin dashboards. Check that corresponding totals agree for the same employee/business date.
7. Use existing Download PDF and Print/Save PDF; check A4 margins and readable output on your desktop and phone.

Screenshots contain only disposable synthetic test records.
