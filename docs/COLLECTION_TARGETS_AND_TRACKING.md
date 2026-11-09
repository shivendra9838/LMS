# Daily collection target and payment tracking

Implemented 27 October 2026 in the existing Admin and Employee dashboards.

## Navigation and acceptance
Open Dashboard > Daily collection target & payments in either portal.
- Targets & customers shows schedule-derived KPI cards, customer installments and current overdue amounts as of the selected business date.
- Payment tracking shows actual receipts once each, including customer, employee, loan number, amount, method, received date, entry date and secure receipt/history link.
- Admin can select an employee, inspect a receipt, enter review remarks and Verify Payment. Employee can view only their own receipts and cannot verify.
- Not Collected appears for unpaid installments due on the selected date. Recorded and Partially Paid describe unreviewed receipts. Verified is a separate receipt review state; the original partial receipt classification and installment balances remain intact.
- Admin review and settlement verification remain separate. Review does not post customer credit or move funds.

## Financial definitions
Dates use Asia/Kolkata. Monetary calculations use integer paise.
- Target: scheduled installments due on the chosen date, excluding cancelled loans.
- Collected: positive actual receipts received on that date, counted once even across multiple allocations. Receipt employee determines cash-flow attribution.
- Target covered: allocations received on or before that date against its due installments, including advances.
- Remaining: target minus target covered, with per-installment coverage capped at its scheduled amount.
- Collection percentage: target covered / target, from 0 to 100%. No scheduled target shows N/A. It is not cash receipts divided by target, since receipts can cover other due dates.
- Overdue: remaining amounts on schedules before the chosen date, including loans past maturity.
- Backdated receipts appear on their actual receipt day; original entry timestamps remain visible. Reports use current knowledge of allocations, including entries recorded later; they are not a reconstruction of what the system knew at the time.
- Assignment changes do not move cash between collectors. Existing allocations still cover the loan's schedule.
- Older records without sufficient allocation/date evidence show a historical-reconstruction warning and conservative remaining amounts. No historical records are repaired or assigned fabricated dates.

## APIs and persistence
GET /api/v1/dashboard/collection-performance?date=YYYY-MM-DD&employeeId=...&page=1&limit=20 — authenticated, scoped read-only targets, team summaries and paginated customer breakdown.
GET /api/v1/collections/tracking?date=YYYY-MM-DD&employeeId=...&page=1&limit=20 — authenticated, scoped receipt listing and review metadata.
POST /api/v1/collections/receipt/:collectionId/verify — existing Admin-only idempotent review now accepts optional remarks (maximum 1000 characters).
CustomerPaymentReview has one additive remarks field. Existing reviews and financial documents are not migrated. Review and audit continue to commit together; unique collectionId prevents repeated verification. Existing recording idempotency and financial transactions are unchanged.
Dashboards refresh on notification SSE events, focus/visibility changes and a 15-second fallback. New collection panels retain their data and in-progress review remarks while refreshing.

## Files created or updated for this upgrade
- backend/src/services/collectionPerformance.service.js (new)
- backend/src/services/customerPaymentReview.service.js
- backend/src/models/CustomerPaymentReview.js
- backend/src/routes/dashboard.routes.js
- backend/src/routes/collection.routes.js
- frontend/src/components/dashboard/CollectionInsights.jsx (new)
- frontend/src/components/dashboard/collection-insights.css (new)
- frontend/src/hooks/useCollectionRefresh.js (new)
- frontend/src/pages/admin/Dashboard.jsx
- frontend/src/pages/employee/Dashboard.jsx
- frontend/src/components/collections/PaymentReviewModal.jsx
- backend/tests/unit/collectionPerformance.test.js (new)
- backend/tests/integration/collectionPerformance.integration.test.js (new)
- frontend/tests/collectionInsights.test.mjs (new)

## Executed checks
- Backend: 27 suites, 212 tests passed, configured coverage thresholds passed.
- Frontend: 24 tests passed, ESLint passed and production build passed. Production build output: tmp/collection-insights-final-build; existing dist edits preserved.
- New calculation tests cover unpaid/overdue, advance payments, mixed allocations, partial payments, backdated receipts, historical cutoff, no target, legacy ambiguity and reassignment attribution.
- API tests cover Admin filtering, employee ownership, invalid dates/paging, review remarks, unchanged loan balance on review, receipt pagination and one listing per advance receipt.
- Browser testing used only a disposable MongoDB replica set, synthetic users/customer/loan and actual application APIs. Admin review with remarks was visible to Employee. Employee had no review action. Date filtering showed a future installment already covered by advance, with zero receipts on that future day. Recording a separate synthetic receipt updated Employee target coverage from 28.57% to 100% without manual refresh.
- Both target and payment views in both portals were checked at widths 320, 360, 375, 390, 412, 480, 768, 1024, 1366 and 1920px. No document horizontal overflow. New controls were at least 44px tall; existing mobile bottom navigation remained accessible. Browser console errors: none.
- A read-only raw BSON hash comparison confirmed configured financial documents unchanged, including the existing 700-rupee receipt. No synthetic records were created in Atlas.
- Normal backend restarted successfully on port 5000 with configured MongoDB. No loan calculations, recording logic, settlement calculations, balances or original receipts were changed.
- Remaining manual verification: real Android hardware, camera/file-picker behavior outside these new screens, and high-volume production performance. No real-device testing is claimed.

Screenshots: docs/screenshots/collection-insights/admin-desktop.png, admin-mobile.png and employee-mobile.png. All screenshot data is synthetic.
