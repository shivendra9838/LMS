# Customer Details redesign — Admin and Employee

Completed 7 November 2026 using the supplied Customer Dashboard UI reference and attached brief.

## Files changed

Profile UI:

- `frontend/src/pages/admin/CustomerDetails.jsx`
- `frontend/src/pages/employee/CustomerDetails.jsx`
- `frontend/src/components/customers/CustomerProfileHeader.jsx` (new shared header)
- `frontend/src/components/customers/customer-profile.css` (new scoped styles)
- `frontend/src/components/customers/CustomerDetailSections.jsx` (shared four-metric overview and portfolio counts)
- `frontend/tests/customerProfileHeader.test.mjs` (new)

Style isolation correction:

- `frontend/src/pages/admin/Customers.jsx`
- `frontend/src/pages/admin/customers-directory.css`
- `frontend/tests/adminCustomerDirectory.test.mjs`

The directory's `acd-*` prefix collided with the existing Customer Details styles. It now uses `acdir-*`; its design, data handling and actions are otherwise unchanged. This prevents navigation order from affecting Customer Details styling.

Read-only response enrichment and regression assertions:

- `backend/src/services/customerOverview.service.js`
- `backend/src/services/customerPortfolio.service.js`
- `backend/tests/integration/customerPhoto.integration.test.js`
- `backend/tests/integration/customerPortfolios.integration.test.js`

## Implemented

- Full available page width with compact identity, employee assignment and action areas.
- Existing circular customer photo/fallback and secure photo editor reused. Camera control sits at the lower-right edge, four pixels below the photo frame. Photo preview retains its original aspect ratio; upload/edit and preview remain separate actions.
- Shared risk strip retains the existing backend assessment and modal. Refresh uses each portal's current read/refresh mechanism.
- Four metrics: outstanding, overdue, recorded collections and overdue installment count. Mobile uses a 2×2 grid; desktop/laptop uses four columns.
- Next unpaid installment displays the saved loan/day/date, scheduled, paid and remaining amounts with the existing status presentation.
- Portfolio summary displays total, active and completed/closed loan counts. Existing location, KYC, receipt and overdue-day information remains available under More portfolio information when provided.
- Admin retains all eight detail sections, profile/KYC editing, controlled status changes, reassignment, authorized issuance and existing portfolio breadcrumbs/routes.
- Employee retains profile/KYC editing, issuance when already eligible, personal/contact/identity sections and timeline. No Admin status/reassignment controls are passed to the Employee header.
- Shared logo assets, portal header/sidebar, notifications and bottom navigation were not edited.

## API/data safety

The existing ownership-protected `GET /customers/:id` now returns additional read-only financial-summary fields for the Employee view: active/closed counts, recorded receipt total/count/date, overdue installment count and next unpaid installment. It reuses saved balances, shared overdue/status helpers and the existing valid-receipt filter used by Admin. Existing summary fields retain their calculations.

The existing Admin `GET /customer-portfolios/customers/:id` adds `closedLoanCount`, using explicit COMPLETED/CLOSED statuses. Cancelled loans are not silently classified as closed. No endpoint or permission expansion was introduced. No loan calculations, allocations, stored customer/KYC data, payments, settlements, approval logic or production records were modified. No migration or database reset was performed.

## Executed verification

| Check | Result |
| --- | --- |
| Full frontend tests | PASS: 225, zero failures/skips |
| Focused UI tests after layout fixes | PASS: 15, then 11 after the final optional metadata addition |
| Frontend lint | PASS |
| Production build | PASS |
| Full backend tests / coverage gates | PASS: 48 suites, 434 tests |
| Final focused photo/portfolio backend tests | PASS: 27 |
| Both portals at 320, 375, 390, 430, 768, 1024, 1366, 1440, 1920px | PASS: no document horizontal overflow |
| Long names + missing photos + inactive status at 320/1024px | PASS: no overflow, no inactive issuance link |
| Photo position and mobile amounts | PASS: camera is below lower-right edge; fixture amounts remain one line at all mobile widths |
| Private photo preview, original aspect ratio, zoom, Escape | PASS with synthetic image in browser fixture |
| Missing photo preview and upload editor disabled-until-file state | PASS |
| Risk details, Admin edit/loan routes, reassignment/status dialog open/cancel | PASS without submitting writes |
| Admin detail section navigation, both load-error retries | PASS |
| Unauthorized customer access / photo permissions / immutable-record checks | PASS in isolated backend integration tests |

Visual testing found a legacy `display: contents` rule splitting mobile metric labels and values into separate flex items. The new scoped layout fixes that rule. Amount line heights and all requested viewport widths were rechecked after the fix.

Browser tests used the actual pages and shared portal shell with a local synthetic Axios adapter. Test data/images were never added to the configured database. Backend tests used isolated MongoDB databases. No live activation, reassignment, loan issuance, profile/photo save, KYC change or financial action was performed in the browser. Native links were checked against existing routes; destination pages in the fixture are placeholders, not live workflow completion.

## Evidence and remaining acceptance

Logs, temporary read-only fixture source and measurements are in `tmp/customer-profile-redesign/`. Final screenshots include `admin-desktop-final.jpg`, `employee-desktop-final.jpg`, `admin-mobile.jpg`, `employee-mobile-final.jpg` and `employee-mobile-financial.jpg`. Screenshots contain clearly labeled synthetic data.

Physical Android/iPhone testing, live account-specific photos/data and real camera capture were not verified. On an authorized test account, open both Customer Details pages, check photo preview/upload cancellation, risk modal, summaries and existing navigation. Confirm scrolling exposes all sections above the unchanged bottom navigation. If the backend uses a non-watching start command, restart it to expose the added read-only summary fields.
