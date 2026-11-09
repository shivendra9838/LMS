# Admin Customers directory redesign

Completed 7 November 2026 against the supplied Customers Dashboard Views reference.

## Changed files

- `frontend/src/pages/admin/Customers.jsx`: full-width directory, six summary metrics, explicit Apply/Reset filters, responsive employee table/list and existing portfolio navigation.
- `frontend/src/pages/admin/customers-directory.css` (new): page-scoped card-free layout, separators, compact controls, table columns and mobile rows.
- `frontend/tests/adminCustomerDirectory.test.mjs` (new): four regression tests covering summary values/missing data, active loan counts, one row/link per employee and filter query behavior.
- `backend/src/services/customerPortfolio.service.js`: additive read-only response fields on the existing authorized directory endpoint.
- `backend/tests/integration/customerPortfolios.integration.test.js`: assertions for new summary fields and actual active loan counts.

The logo assets, brand name/tagline, shared sidebar/header/notification/bottom navigation, Employee Portal, other Admin page designs, authentication and assignment workflows were not modified. Existing uncommitted changes were retained.

## UI and behavior

- Removed the outer directory panel and employee cards. Desktop/laptop uses the available content width, thin row dividers and compact table columns.
- Six summary metrics are displayed without card backgrounds. Desktop/laptop metrics are horizontal; mobile metrics use two columns. Tablet uses a compact three-column summary.
- Search, branch/status, sort field/order and pagination remain server-side. Apply Filters writes the existing query parameters; Reset clears directory filters and preserves page size. Browser Back restores URL filters and pagination.
- Mobile uses one full-width employee link row with circular photo/initials, name, code, status and arrow. Enter activates the existing portfolio link through native anchor behavior. Desktop retains private photo preview independently from View Customers.
- Only the currently displayed table or mobile list mounts. Hidden duplicate photo components do not make duplicate image requests.
- Existing Customer Requests, Add Customer, risk, All Customers and Unassigned Customers routes remain available as compact shortcuts.
- Empty, loading, unavailable-value and retry states remain visible. Missing backend values show a dash, not invented zeroes.

## Read-only API addition

The existing `GET /api/v1/customer-portfolios` response did not contain all requested metrics. Its summary now additionally provides `activeEmployees`, `inactiveEmployees` and `totalOutstanding`. Employee rows now include `activeLoanCount`, summed from the existing per-customer loan summary. The previous `activeLoanCustomers` field is preserved and is not mislabeled as a loan count.

Outstanding uses existing saved loan remaining balances and the shared cents conversion. It includes loans belonging to existing customers, including unassigned customers. Summary totals remain directory-wide, as before, rather than totals of the current filtered page. No new endpoint, financial write, allocation formula, loan calculation, migration or stored record update was introduced.

## Executed checks

| Check | Result |
| --- | --- |
| Full frontend tests | PASS: 223, zero failures/skips |
| Focused new frontend tests after final fixes | PASS: 4 |
| Frontend lint | PASS after correcting a missing Node URLSearchParams test import |
| Production build | PASS |
| Portfolio backend integration tests | PASS: 15 |
| Full backend tests and coverage gates | PASS: 48 suites, 434 tests |
| Responsive widths | PASS: 320, 375, 390, 430, 768, 1024, 1366, 1440, 1920px |
| Search and Apply/Reset | PASS in browser fixture |
| Branch + status + outstanding sort descending | PASS in browser fixture; actual query semantics also tested by backend integration |
| Pagination, portfolio link and browser Back | PASS; filters and page retained |
| Empty results, failed GET and explicit Retry | PASS |
| Employee status, summary and outstanding display | PASS using supplied fixture values and actual isolated backend calculations |

Responsive measurements found no document horizontal overflow; table scroll width equals its available width. A laptop status wrapping issue was identified and fixed, followed by new measurements and visual inspection. All nine widths were rechecked after that fix. The original logo and shared portal layout remain unchanged.

Backend tests use isolated MongoDB test databases, including a financial-record fingerprint check around read-only directory operations. Browser QA used the real page and shared portal shell with a synthetic Axios adapter at port 5180, not the configured database. No dummy employee/customer was added to the configured application. Receipt/payment/settlement writes shown in test logs belong only to existing isolated test workflows.

## Evidence and manual acceptance

Logs, fixture source, screenshots and final width measurements are under `tmp/customers-directory/`. Screenshots include `desktop.jpg`, `laptop-1024.jpg`, `laptop-1366.jpg` and `mobile.jpg`; all contain synthetic QA data.

Physical Android/iPhone testing and live authenticated account-specific data were not verified. Manually open Admin > Customers, apply a branch/status filter, change sort order, paginate and select View Customers. Confirm the original employee portfolio opens. If running the backend without automatic reload, restart it to expose the additive summary fields. No live financial action is required for acceptance.
