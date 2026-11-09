# Employee dashboard simplification and collectible targets

## Changes

The Employee Dashboard now contains exactly four main KPI cards: Today's Target, Collected Today, Remaining Today and Active Customers. The duplicate six-card recovery section and its explanation are removed from this dashboard. Their shared calculations and use on other pages remain intact.

The separate right-side Recent Activities panel is removed. Targets & Customers / Payment Tracking / Recent Activities tabs remain in a full-width workspace. Search, filters, pagination, row actions, collection progress, loan selector and receipt trend remain available.

## Calculation basis

For Asia/Kolkata business date D, using integer paise and original saved installment schedules:

- **Opening target** = sum, over eligible assigned-loan installments due on or before D, of scheduled amount minus valid coverage received before D, with each installment capped between zero and its scheduled amount.
- **Remaining** = outstanding balance on those same due-on-or-before-D installments after valid allocations received through D.
- **Collected** = valid customer receipt amounts actually received on D, deduplicated by receipt identity and attributed using the existing collector rules. It includes authorized advances and uses received date rather than record creation date.
- **Coverage on D** = allocations received on D to installments due on or before D. Future allocations and unapplied amounts do not reduce remaining collectible.

Opening target stays stable as payments received on D are entered; remaining changes. A later authorized backdated entry can revise a reconstructed day's target/remaining. There is no frozen opening snapshot or new accounting ledger.

Example: opening ₹2,726.68; ₹1,200 receipt with ₹1,000 applied to eligible overdue/today dues and ₹200 to future dues results in actual collected ₹1,200 and remaining ₹1,726.68. The actual receipt is never blindly subtracted from the target.

The existing scheduled-only `target`, `remaining` and coverage metrics remain unchanged for other consumers. New additive response fields are `openingCollectible`, `collectibleAllocatedOnDate`, `collectibleHistoryKnown` and `collectibleBalanceKnown`. Existing collectible fields continue to report outstanding balances.

The drill-down now includes overdue and date-due installments, original dates, opening target, allocations on date, current/as-of remaining and actual receipts. Employee API also returns `recoveryBreakdown` separately from its original scheduled-only breakdown.

Historical reconstruction uses existing allocation receipt dates, excludes later receipts, and preserves the existing invalid-receipt safeguards. Incomplete legacy dates yield an **Unavailable** opening target and a visible explanation. A same-day legacy last-paid timestamp does not establish the timing of every unmapped partial payment. Historical remaining is also unavailable when its evidence cannot be reconstructed. No missing receipt, allocation or opening balance is invented.

Active Customers remains the real assigned active-customer count; due and overdue counts are independently deduplicated customer sets. A customer can legitimately belong to both sets.

## Modified files

- `backend/src/services/collectionPerformance.service.js`: additive opening-target and reconstruction fields; existing payment writes untouched.
- `backend/src/services/employeeDashboard.service.js`: overdue/date-due drill-down projection.
- `backend/tests/unit/collectionPerformance.test.js`: 12 new opening, partial, full, advance, historical, reversal-projection and legacy regressions.
- `backend/tests/integration/dashboardFinance.integration.test.js`: cross-customer opening target, partial collection updates, empty portfolio assertions.
- `frontend/src/pages/employee/Dashboard.jsx`: four-card summary, updated labels/values and warnings, side-panel removal.
- `frontend/src/components/dashboard/FinancialBreakdown.jsx`: collectible opening/remaining breakdown with original due dates.
- `frontend/src/components/dashboard/employee-workspace.css`: full-width lower workspace across breakpoints.
- `frontend/tests/dashboardFinance.test.mjs`: updated breakdown fixture, preserving advance/remaining assertions.
- `frontend/tests/dashboardSummary.test.mjs`: four-card and historical-unavailable rendering regressions.
- This report and screenshots under `docs/screenshots/dashboard-simplify`.

No schema migration or endpoint was introduced. No issued loan terms, schedule dates, customer payments or settlements were changed. Existing uncommitted work was preserved.

## Executed tests

- **Backend:** 39 suites, **348 tests passed**, coverage gates enabled. Final run 256.332 seconds. Log: `tmp/dashboard-simplify/backend-tests-final.txt`.
- **Frontend:** **130 tests passed**, zero failures/skips. Log: `tmp/dashboard-simplify/frontend-tests-final.txt`.
- **Frontend lint:** passed. Log: `tmp/dashboard-simplify/lint-final.txt`.
- **Production build:** passed. Output: `tmp/dashboard-simplify/build`.

Financial scenarios tested include today-only dues, overdue plus today, partial overdue recovery, full overdue recovery, mixed overdue/current allocation, advance/unapplied receipts, previous advances, multiple assigned customers, historical dates, invalid/reversed receipt projection, zero portfolio and dashboard reads after actual isolated collection writes. Existing receipt identity, authorization and payment write tests remain intact.

No reversal endpoint exists in the current application. Reversed/voided exclusion was tested with synthetic projection/import fixtures; an actual reversal workflow was not added or claimed tested.

## Browser evidence

Used a disposable MongoMemoryReplSet and the isolated frontend/backend on ports 5187/5017. No test financial submissions were sent to configured Atlas.

- Initial fixture: opening target ₹2,800, actual receipts ₹800, remaining ₹2,000. The drill-down showed ₹800 allocated against original overdue dates and ₹1,300 overdue + ₹700 today remaining.
- Selected prior business day: reconstructed target ₹2,100, receipts ₹0 and remaining ₹2,100. Today's later receipt did not pay that historical day early.
- Returned to Today and reloaded: correct current values restored.
- Checked target breakdown, search, next-page action, Payment Tracking receipt and retained Recent Activities tab. Search did not alter aggregate KPI totals. No browser console errors were reported.
- Dashboard checked at **320, 375, 390, 430, 768, 1024, 1366 and 1920px**: four KPI cards, no duplicate summary, no side activities panel, no horizontal page overflow, and workspace width equal to its available grid width.
- Payment Tracking and Recent Activities checked at the same widths: no horizontal page overflow. **24 layout checks total**. Matrices: `tmp/dashboard-simplify/responsive.json` and `tabs-responsive.json`.
- Desktop and mobile screenshots saved and visually inspected: `docs/screenshots/dashboard-simplify/dashboard-1366.png` and `dashboard-390.png`. They contain synthetic records only.

The normal local backend was restarted with these read-only calculations; MongoDB connected successfully. The protected dashboard endpoint returned 401 without authentication, and the normal frontend dashboard URL returned 200. The normal application remains at http://localhost:5173/employee/dashboard.

## Manual acceptance

1. Sign in as Employee and confirm only four top cards.
2. Open the Target or Remaining breakdown; compare the original overdue/today installments with real authorized testing receipts.
3. Select an earlier date and return to Today. Check received dates rather than entry dates.
4. Record an actual authorized test payment through the existing collection flow. Confirm target remains at opening basis, actual receipts increase once, and remaining reduces only by eligible due allocations.
5. Try search, filters, pagination and all three tabs on an Android phone. Physical-device/keyboard testing was not performed; browser viewport checks do not substitute for it.

No configured financial data reset, repair or synthetic record creation was performed in this task. A comprehensive before/after Atlas hash comparison was not performed.
