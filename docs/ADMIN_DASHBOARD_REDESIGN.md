# Admin dashboard redesign

Implemented the reference-inspired navy and gold dashboard using existing authorized APIs. No migration, financial write, reset, ledger repair, or configured-database test fixture was run.

## Interface

- Compact management heading, explicit IST business date and Refresh.
- Nine live KPIs, with red overdue and green received amounts; current portfolio balances remain distinct from selected-date collection figures.
- Gold actual-receipt / blue scheduled-installment chart; existing analytics date, employee, location, status and method filters and all Excel export choices retained.
- Employee performance with authenticated photo retrieval when available, initials fallback, real employee detail links, current outstanding and period receipts. Bars explicitly compare period receipts with the largest total in the view; they do not invent target completion or a performance score.
- Daily targets and Payment Tracking retain employee filters, pagination, review actions, remarks and receipt/history links. Compact mode avoids repeating the old recovery KPI grid. Background refresh keeps the Admin view and entered review controls mounted.
- Upcoming installments show scheduled, paid and remaining amounts independently, including advance-payment status.
- Recent settlements include employee name/code and original submission, transfer and review timestamps. Reversed/rejected states remain separate from collection receipts.
- Operational counts, approvals, account requests, follow-ups, audit and lazy area analytics preserved.
- Five native mobile accordions retain their child controls; desktop opens them automatically. Existing hamburger drawer and bottom navigation remain accessible.
- Removed only the Admin Notifications sidebar shortcut. Bell, unread count, SSE connection, popup and `/admin/inbox` remain available.

## Financial definition clarification

The request's “target = currently unpaid overdue plus due installments” and “remaining = currently unpaid overdue plus due installments” describe the same snapshot. Existing Employee reporting already exposes an opening collectible target separately. The Admin KPI is explicitly labeled **Collection target · opening**, reusing `openingCollectible`; it is not a changed accounting formula.

The Daily Collection section also identifies the **current collectible target / remaining** as the same unpaid balance, using `remainingCollectible`. It never subtracts actual receipts again. Actual-receipts/opening-target percentage uses the existing Employee presentation helper, with percentages above 100% retained and a bounded progressbar. Scheduled due-date coverage remains separately labeled, including advance allocations. Unknown legacy reconstruction is unavailable, not estimated. Analytics range filters affect charts and exports; the breakdown employee filter does not silently change the all-employee headline totals. Operational figures remain for the current IST day.

## Files changed for this task

Paths below are relative to `C:/Users/shive/Desktop/LMS`.

- `frontend/src/pages/admin/Dashboard.jsx`
- `frontend/src/pages/admin/admin-dashboard.css` (new scoped theme)
- `frontend/src/components/dashboard/CollectionInsights.jsx` (optional controlled date and compact mode)
- `frontend/src/components/dashboard/DashboardKit.jsx` (optional responsive accordions, upcoming balances, settlement metadata)
- `frontend/src/components/dashboard/EmployeeDashboardAvatar.jsx` (new authenticated blob photo component)
- `frontend/src/layouts/PortalShell.jsx` (Admin shortcut only)
- `backend/src/repositories/report.repository.js` (read-only employee `_id` and `hasPhoto` metadata)
- `backend/src/services/settings.service.js` (read-only settlement employee and original submission metadata)
- `frontend/tests/adminDashboard.test.mjs` (new)
- `backend/tests/integration/settings.integration.test.js` (two isolated regression tests)
- This report and `docs/screenshots/admin-dashboard-ui/` evidence.

No schema, calculation, authorization route, KYC, receipt, payment or settlement mutation logic changed. Existing uncommitted work was retained.

## Executed checks

| Check | Result |
| --- | --- |
| Full backend Jest with coverage | PASS — 39 suites, 353 tests |
| Frontend Node test suite | PASS — 144 tests |
| Frontend ESLint | PASS |
| Vite production build | PASS — output under `tmp/admin-dashboard-ui/build` |
| Normal backend startup / configured MongoDB connection | PASS — MongoDB Connected; port 5000 health returns OK |
| Normal frontend availability | PASS — local Vite website available on port 5173 |
| Responsive DOM bounds | PASS — 320, 375, 390, 430, 768, 1024, 1366, 1440, 1920px; nine KPIs; no horizontal page overflow |
| Expanded mobile sections and report filters | PASS — checked at 320/390px; View All remains accessible |
| Drawer, Refresh, target/payment tabs, employee selector | PASS — disposable browser fixture |
| Business date synchronization | PASS — native keyboard date change updated receipt/target/remaining values and breakdown date while current portfolio balances stayed current |
| Bell and full inbox | PASS — Live connection, popup within mobile viewport, existing inbox route reachable |
| Upcoming View All | PASS — opens Admin collections with Upcoming selected |
| Lazy area chart | PASS — opens and renders existing report data |
| Excel export | PASS — browser downloaded `daily-report-2026-11-04.xlsx` from the isolated fixture |
| Browser console after final clean reload | PASS — zero new captured errors |
| Physical Android/iPhone testing | NOT VERIFIED — browser viewport emulation only |

Tests use MongoMemoryReplSet. Browser checks used the existing disposable `loan_tabs_disposable` fixture on ports 5017/5187, with synthetic accounts and data isolated from Atlas. Those disposable servers were stopped after verification. No payment, approval, settlement, or financial edit was submitted to the configured database. No before/after hash audit of the entire Atlas database was performed.

Evidence: `desktop-1366.jpg`, `mobile-390.jpg`, `tablet-768.jpg`, `mobile-sections-390.jpg` under `docs/screenshots/admin-dashboard-ui/`. Values in these screenshots are synthetic QA data, not your live balances.

## Manual acceptance

1. Open `http://localhost:5173/admin/dashboard` and refresh the browser if it has an old cached view.
2. Compare live balances with Loans and Collections; change Business date and confirm only the date-specific collection KPIs and breakdown change.
3. Expand Daily Collection, filter an employee, switch Payment Tracking and open an existing receipt. Do not treat receipt review as settlement verification.
4. Apply analytics date/location/employee filters and export the required report.
5. Open Upcoming View All, employee details, Reconciliation History and the bell's full inbox.
6. On a real Android phone, check drawer, date picker, bottom navigation, accordion controls and large-currency readability. Native date input order follows the browser locale; the adjacent date caption is unambiguous.

No unresolved test failures were found. Physical-device behavior and your account-specific live records still need your acceptance review.
