# Employee dashboard reference implementation — 28 October 2026

The working Employee Dashboard now follows the supplied Dark Gold Employee Collection Dashboard reference. The original Royal Enterprises artwork, shared navigation, notification bell, profile menu, payment form, receipts and installment history are reused.

## Implemented

- Dark charcoal surfaces, restrained gold buttons, four compact KPI cards with green, blue, amber and purple icons.
- An accessible native date picker defaults to the Asia/Kolkata business date. Today resets it. Date selection changes schedule coverage, receipt totals, the seven-day chart and the table. Customer count is explicitly current, not a reconstructed historical assignment count.
- Actual receipts and scheduled coverage remain different metrics. Receipt percentages can exceed 100%; progress bars are bounded at 100%. No scheduled target shows an unavailable percentage.
- Loan selector and a five-installment timeline near the selected day; swipe on small screens and View Full Schedule for the entire loan. Scheduled amount, allocated amount and remaining balance are distinct for partial payments.
- Targets & Customers, Payment Tracking and Recent Activities tabs; literal customer/name/code/loan/mobile search; All, Due Today, Paid and Overdue filters; server pagination; responsive mobile cards.
- Collect opens the existing modal with the current authorized schedule and balance, even when viewing a historical date. Paid or sequence-locked installments offer View. History is only offered for actual allocation evidence and uses the existing exact-installment API.
- Real persisted notifications supply activities. Opening one uses the existing server-authorized destination and read-state update. No artificial target milestones or sample rows are generated.
- Refresh uses existing financial events, notifications, focus and visible-page polling. Loading, retry, empty states, keyboard focus and reduced-motion styling are included.
- Supplemental overdue, loan, KYC and settlement links preserve access to existing work. Company settlement is explicitly separate from customer receipt review.

## Files created or modified for this request

Frontend:
- `frontend/src/pages/employee/Dashboard.jsx`
- `frontend/src/components/dashboard/EmployeeWorkspace.jsx`
- `frontend/src/components/dashboard/employeePresentation.js`
- `frontend/src/components/dashboard/employee-workspace.css`
- `frontend/tests/employeeDashboard.test.mjs`
- `frontend/tests/employeeWorkspace.test.mjs`

Backend:
- `backend/src/routes/dashboard.routes.js`
- `backend/src/services/employeeDashboard.service.js`
- `backend/src/services/collectionPerformance.service.js`
- `backend/tests/integration/collectionPerformance.integration.test.js`

Documentation/evidence:
- This report.
- `docs/screenshots/employee-dashboard-reference-desktop.png`
- `docs/screenshots/employee-dashboard-reference-mobile.png`
- `docs/screenshots/employee-dashboard-mobile-collections.png`

## API and data safety

Added authenticated Employee-only `GET /api/v1/dashboard/employee-workspace` with validated `date`, `filter`, `search`, `page`, `limit` and optional assigned `loanId`. It is a read-only projection using the existing collection-performance calculator, receipt allocations, current loan status and authoritative sequence-state helper. The calculator has an optional future-row projection flag; its existing default behavior is unchanged. Current collection eligibility is never reconstructed from a historical display date.

The response includes totals, due count, current active customer count, seven real receipt-day totals, assigned loan choices, selected-loan timeline, filter counts and paginated schedule rows. Mobile numbers are used for authorized search and are not returned by this endpoint. Another employee's loan is unavailable; cross-employee querying and Admin use of this Employee-only endpoint are rejected.

No schema, financial-write API, payment allocation rule, loan calculation, KYC workflow, configured record or notification transport was changed. No migration is required. The configured Atlas financial reconciliation matched the previous verified snapshot exactly, including the protected ₹800 receipt, allocations, loan balances, cashbook entry and custody position. Browser and automated synthetic records existed only in disposable local MongoDB instances.

## Executed checks

- Backend: **36 suites / 305 tests passed**, including new dashboard date, allocation, search, pagination, role/ownership, validation, empty-state and read-only regression checks.
- Frontend: **87 tests passed**, including exact receipt percentages, status/date boundaries, timeline window, history/sequence controls, receipt review labels and empty activities.
- Frontend lint: **passed**.
- Production build: **passed**, output isolated in `tmp/employee-dashboard/build` to preserve existing generated files. Vite notes that this output directory is outside its project root; build completed successfully.
- Normal frontend: HTTP 200 on port 5173. Normal backend: connected to configured MongoDB on port 5000; the new endpoint rejects unauthenticated requests with HTTP 401.
- Browser: tested actual widths **320, 375, 390, 430, 768, 1024, 1366 and 1920**. Document scroll width never exceeded its client width. Mobile customer cards, constrained swipe timeline, responsive chart, desktop KPI row, tablet KPI grid, mobile hamburger and bottom navigation were checked.
- Browser interactions: native calendar selection to the previous day changed receipts to zero, timeline to historical coverage and chart dates; Today restored the current view. Paid filtering returned paid rows only. Mobile-number search, payment tracking and exact receipt activity navigation worked. Unread count changed from 3 to 2 and remained read across reload.
- Browser financial fixture: initial receipts ₹700 + ₹800 showed ₹1,500 actual receipts, Day 2 allocated ₹700 and Day 3 allocated ₹100 with ₹600 remaining. Day 3 History showed only its ₹100 allocation. Collect opened Day 3 with ₹600 remaining; its authoritative preview allocated ₹600 to Day 3. Saving that synthetic payment created one ₹600 receipt, and returning to the dashboard showed ₹2,100 actual receipts without logout/login. No browser console errors were captured.
- Existing Admin login/dashboard compatibility checked against the same disposable API; no Admin dashboard redesign was performed.

## Deliberate limits / manual checks

- Browser viewport emulation is not physical Android/iPhone testing. Check the native date picker, numeric keyboard, swipe timeline, notification dropdown and bottom navigation on a real phone.
- Activity is the latest real notification history and is independent of the selected financial date. No fictional Target Completed or Customer Assigned events are synthesized.
- New monthly assignments are omitted because the existing data does not reliably date every reassignment. Current active assigned customer count is shown instead.
- No Employee export button is added because this dashboard has no existing authorized export endpoint. Admin reporting remains unchanged.
- Full-page screenshot capture was unavailable in the in-app browser. Saved viewport captures show the dashboard and mobile collection section using synthetic data only.
- This task does not claim a fresh exhaustive test of every unrelated application screen.

## Browser acceptance steps

1. Open `http://127.0.0.1:5173/employee/dashboard` after signing in with your normal Employee account.
2. Compare the layout with the supplied reference. Switch between desktop and phone widths.
3. Choose a past date and then Today; confirm receipts, scheduled coverage and trend change appropriately.
4. Search a customer, loan number or mobile; try all four filters and pagination.
5. Select a loan in Collection Progress, then open View Full Schedule.
6. Open History only on an allocated installment. Confirm its own allocated amount and remaining balance.
7. Collect only a genuine payment through the existing confirmation/preview flow. Return to Dashboard and confirm the new actual receipt total and next eligible installment.
8. Open a recent activity and confirm the exact record opens and its notification stays read after refresh.
