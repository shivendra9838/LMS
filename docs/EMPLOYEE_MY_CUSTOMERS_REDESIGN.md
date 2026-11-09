# Employee My Customers — reference redesign

The existing Employee My Customers page now follows the supplied desktop/mobile reference: navy background, dark sidebar/header, gold selected navigation, four compact statistics, three working actions, a rounded search/filter toolbar, dark desktop table and stacked mobile customer cards. The original company artwork, account menu, notification bell and mobile navigation are reused. Admin styling is unchanged.

## Components and working features

- Real Total, Active, At Risk / Insufficient and Inactive counts; each card applies its corresponding filter. Summary cards describe the whole assigned portfolio. Filter chips describe the search/location/category scope before the account-status chip is applied.
- Account status remains separate from repayment category. The review group includes High Risk, Review Required and Insufficient History, so it can overlap Active or Inactive. Insufficient History is not presented as proven bad behavior. Customer status has ACTIVE/INACTIVE values; the Inactive / Closed card counts inactive accounts, not customers whose loans happen to be fully paid.
- Existing Add Customer KYC and KYC draft/approval-status routes. Existing risk-filter directory remains available through Repayment Risk & Filters.
- Literal, debounced name/code/mobile/city/area search, immediate Clear Search, advanced city/area/category filters, All/Active/At Risk/Inactive chips, five sorts and backend pagination.
- Real active assigned loan counts open the existing My Loans page with an authorized customer filter. Loan history remains available even if active count is zero.
- Secure lazy-loaded customer photos and initials fallback through the existing CustomerIdentity/CustomerPhoto components. No stock or public customer-photo URLs were introduced.
- Existing customer-row Enter/Space handling, clickable names/photos/codes and independent action controls. Desktop Eye, risk, edit and More actions; mobile full-card/chevron opening, phone/location, risk analysis, loan badge and compact More menu including Edit or controlled KYC revision.
- One shared existing risk modal/controller per rendered customer row/card. Existing calculator, thresholds, score publication policy and moving speedometer remain unchanged. List summaries are supplied by the backend, and opening details retrieves the full existing analysis.
- Existing account-status update action is retained behind a confirmation dialog. Approved KYC profiles continue to use the revision route instead of direct editing. No configured customer status was changed during verification.
- Scoped CSV export of all current filtered results, not just the visible page. Includes permitted contact/location/account status and assigned-loan summaries; excludes identity documents, bank information, private storage paths and unrelated employees. CSV cells are quoted and spreadsheet formula prefixes are escaped.
- Loading, empty, retry, export-error and busy states; focus indicators, reduced-motion styling and touch-friendly mobile controls.

## Backend/API changes

Added Employee-only authenticated reads:

- `GET /api/v1/customers/portfolio` — `page`, `limit`, `search`, `filter`, `sort`, optional `city`, `area`, `category`. Returns paginated rows, portfolio summary, contextual chip counts and pagination metadata.
- `GET /api/v1/customers/portfolio/export` — same filters/sort; returns authorized CSV with `Cache-Control: no-store`.

Both validate input, authorize the active account and scope all customers to the JWT employee. Another employee cannot be selected through query parameters. Admin retains its existing APIs; these new endpoints reject Admin use. Loan counts/outstanding summaries include only loans assigned to the authenticated employee.

The service reuses the existing risk assessment in keyset batches of up to 100 customers. It does not persist risk snapshots or change financial records. Only the requested page is sent to the browser. Computing exact current risk-group totals requires scanning the authorized portfolio on the server; no large-portfolio performance benchmark is claimed.

The existing My Loans page now consumes its existing backend `customer` query parameter. No loan API or loan calculations changed. No database migration, schema or dependency change is required.

## Confirmed defects fixed during verification

- Global mobile minimum link heights created large blank gaps between customer code/name. Scoped identity styling keeps mobile headers compact while the full card, photo and action controls remain usable targets.
- Rapid Clear Search followed by sort could restore the old search. React Router query setters do not queue like React state setters. The shared filter hook now keeps the latest intended query, synchronizes text only when the URL search value changes, and commits Clear Search immediately. Two regression tests cover sequential clear/sort and filter/search/page composition; the actual browser sequence was rechecked successfully.
- Mobile Edit remains explicitly available in More actions, including the existing reviewed-KYC revision restriction.

## Files changed

Backend:
- `backend/src/services/employeeCustomerPortfolio.service.js` — new read-only portfolio/export projection.
- `backend/src/services/customerRisk.service.js` — exposes the existing assessment helper for reuse; calculation unchanged.
- `backend/src/routes/customer.routes.js` — new protected read/export routes before the generic customer-ID route.
- `backend/tests/integration/employeeCustomerPortfolio.integration.test.js` — new isolated API regression tests.

Frontend:
- `frontend/src/pages/employee/CustomerList.jsx` — actual redesigned page and authenticated export.
- `frontend/src/components/EmployeeCustomerPortfolio.jsx` — desktop table, mobile cards, actions, status and compact pagination.
- `frontend/src/components/employee-customer-portfolio.css` — page-scoped reference styling.
- `frontend/src/components/CustomerRisk.jsx` — optional trigger rendering reuses the existing modal across row/card action locations; SSR-safe role lookup.
- `frontend/src/layouts/PortalShell.jsx` — Employee My Customers-only shell class and compact mobile company branding.
- `frontend/src/pages/employee/Loans.jsx` — consumes the existing authorized customer filter.
- `frontend/src/components/portfolios/PortfolioUi.jsx` — shared query-state race fix.
- `frontend/src/utils/portfolioQuery.js` — latest-query update helper.
- `frontend/tests/employeeCustomerPortfolio.test.mjs` — UI, routes, risk/status distinction, KYC restrictions and pager tests.
- `frontend/tests/portfolioQuery.test.mjs` — rapid query-update regressions.

Evidence:
- This report.
- `docs/screenshots/my-customers-reference/desktop.png`
- `docs/screenshots/my-customers-reference/mobile.png`
- `docs/screenshots/my-customers-reference/mobile-actions.png`

## Verification results

| Check | Result |
| --- | --- |
| Backend full suite and coverage gates | PASS — 37 suites, 311 tests |
| Frontend full suite | PASS — 95 tests |
| Frontend lint | PASS |
| Production build | PASS — isolated output `tmp/customer-directory/build` |
| Assigned-customer isolation and forbidden edits/export | PASS — API integration |
| Counts, literal/location search, account/risk filters and all sorts | PASS — API integration; representative browser interactions |
| Pagination with retained sort/filter | PASS — API and browser, 13 isolated customers across two pages |
| Filtered CSV | PASS — browser download contained only the one selected customer; API tests cover complete filtered export and formula protection |
| Customer row keyboard / existing details | PASS — Enter opened the existing exact customer route |
| Risk modal and insufficient history | PASS — real analysis showed Not Rated Yet, zero observed installments and no fabricated numeric score |
| Customer-specific loan list | PASS — existing loan list showed the exact assigned customer loan |
| Add KYC / drafts / mobile Edit / More actions | PASS — existing routes opened; no submission or profile mutation was performed |
| Secure photos | Existing photo security tests pass; redesigned browser fixture used initials fallback because its customers had no uploaded photo |
| Notifications and hamburger | PASS — existing live bell, actual unread records, close control and navigation menu retained |
| Console | PASS — no captured errors on completed test views |
| Normal local servers | PASS — frontend HTTP 200; backend connected to configured MongoDB; unauthenticated portfolio request HTTP 401 |

Widths measured after the layout fixes: **320, 360, 375, 390, 430, 480, 768, 1024, 1366 and 1920px**. Document scroll width did not exceed client width. Mobile uses two-column summary cards and customer cards; tablet summary cards use two columns; desktop uses four columns. Large tables use controlled scrolling where needed. Screenshots were visually checked against the supplied reference.

The first targeted backend run passed all four new tests but did not cover enough of the whole application to meet global coverage thresholds. The subsequent full backend run above passed the required coverage gates; they were not disabled or lowered.

## Data safety and remaining limits

No configured customers, KYC records, assignments, payments, installments, settlements, loan balances, scoring thresholds, passwords, company assets or settings were edited. No sample records were inserted into Atlas. Automated tests and browser records were created only in separate disposable local MongoDB instances. The protected configured Atlas payment/loan/schedule/cashbook/custody snapshot matched the previous verified read-only snapshot.

Physical Android/iPhone hardware, very large portfolio load, production hosting and slow-network handover were not tested. The redesigned page reuses existing photo access; a new browser upload/edit of a real customer photo was not performed. Admin layout selectors remain untouched; the dark shell is applied only to the exact Employee `/customers` pathname. Existing backend/frontend regression suites passed, but this task does not claim a fresh manual tour of every unrelated page.

## Manual acceptance

1. Sign in and open `http://127.0.0.1:5173/employee/customers`.
2. Compare desktop and phone layouts with the reference. Confirm your real counts, names, photos and loan totals.
3. Search by mobile or location, change chips/sort, advance a page, and test clearing search immediately before sorting.
4. Export a filtered list and verify it contains exactly the expected authorized customers.
5. Open a customer by row/name/photo, open View Risk Details, and use the active-loan badge.
6. On a real phone, test the More menu, Edit/KYC revision navigation, telephone link, hamburger, notification bell and bottom navigation.
7. Confirm Admin pages retain their existing theme. Use genuine authorized business operations for any record changes.
