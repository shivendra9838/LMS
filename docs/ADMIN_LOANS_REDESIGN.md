# Admin Loans redesign

Updated the existing Admin > Loans page at `/admin/loans` using the supplied reference. Existing uncommitted work was preserved.

## What changed

- Black-and-gold All Loans header with Lucide icon and compact Issue Loan action.
- Issue Loan opens the existing All Customers directory. Select a customer, open Customer Details, then use its existing authorized Issue Loan action. No issuance checks are bypassed.
- Server-side search for loan number, customer name and mobile using the existing API; status and employee filters; inclusive actual issue-date range; Search and Reset Filters actions.
- Employee options are paginated in batches of 100 with Load more employees when needed; option-fetch errors have a separate retry.
- Seven-column desktop table: loan/date, customer/mobile, principal/total, outstanding, employee/code, effective status, existing View Details route. INR amounts are right-aligned.
- Compact phone cards replace the table below 768px. They retain customer/mobile, principal, total payable, outstanding, date, status, issuer and View Details. Native mobile filter disclosure, readable inputs, touch controls, original logo, drawer, notifications, profile menu and bottom navigation remain available.
- Loading skeleton; distinct empty and no-match states; clear/reset and error Retry actions; request cancellation prevents old responses replacing newer filter results.
- Local status styling uses the backend's `effectiveStatus || status`. No frontend overdue or balance calculation was added. Missing amounts are shown as unavailable, never fabricated as zero.

## Files changed

Modified:
- `frontend/src/pages/admin/Loans.jsx`
- `frontend/src/layouts/PortalShell.jsx` — imports route-scoped styling and adds the exact `/admin/loans` shell class.
- `backend/src/services/loan.service.js` — read-only issue-date query support only; existing financial logic retained.
- `backend/tests/integration/financialWorkflow.integration.test.js` — two added issue-date/permission/integrity regression cases; existing tests retained.

Created:
- `frontend/src/components/admin-loans/AdminLoanPresentation.jsx`
- `frontend/src/components/admin-loans/admin-loans.css`
- `frontend/tests/adminLoansUi.test.mjs` — three presentation/state/financial-display regression tests.
- This report and screenshots under `docs/screenshots/admin-loans-ui/`.

## API extension and safety

Existing authenticated `GET /api/v1/loans` now accepts optional `issuedFrom=YYYY-MM-DD` and `issuedTo=YYYY-MM-DD`. These filter `loanDate`, the actual issue date, not `createdAt`. From is inclusive at Asia/Kolkata midnight; Through includes its entire India business day using an exclusive next-day upper bound. Invalid dates, repeated date values and reversed ranges return 422. No date filter means the existing all-dates behavior.

No schema migration, database reset, financial repair, payment, allocation, balance, status, KYC or settlement change was made. Employee access remains constrained by the original ownership query. No new issuance endpoint or permission was introduced.

## Executed verification

| Check | Result |
|---|---|
| Frontend lint, final run | PASS |
| Frontend tests, final run | PASS: 179/179 |
| Production build, final run | PASS |
| Full backend suite with existing coverage gates | PASS: 40 suites, 365/365 tests |
| Loan-number search | PASS: exact existing loan returned |
| Customer-name and mobile search | PASS: each selected the correct customer loan |
| Status + employee filter | PASS: six overdue loans for the selected employee in isolated data |
| Actual issue-date range | PASS: current-day range returned eleven loans; earlier issue-date records excluded |
| Date boundaries/validation/permissions | PASS: backend integration tests cover inclusive India boundaries, invalid/repeated/reversed dates and unauthorized employee scope |
| Pagination | PASS: page two showed 11–20 of 23; page sizes 20 and 100 worked |
| Reset, no matching loans and Clear Filters | PASS in browser |
| View Details | PASS on laptop and mobile: existing loan details and financial summary rendered |
| Issue Loan | PASS: existing All Customers page opens; no loan created through browser |
| Keyboard search and mobile drawer | PASS: Enter submits search; drawer closes with Escape |
| Table/header contrast | PASS after fixing shared white table-header styling |
| All ten requested viewports | PASS: no page-level horizontal overflow; mobile cards below 768px; table contained scrolling at tablet/narrow laptop sizes |
| Expanded filters on 320/375/390/430px | PASS: no panel/page overflow |
| Displayed source values | PASS: all 23 isolated loan rows matched API principal, payable, outstanding and effective status |
| Financial preservation | PASS: before/after fingerprints unchanged for isolated customers, loans, schedules, collections, positions, settlements and cashbook |
| Browser console | No errors reported in final check |
| Normal local backend | Restarted to load read-only date filter; health OK, MongoDB connected |

Widths tested: 320, 375, 390, 430, 768, 1024, 1280, 1366, 1440 and 1920 CSS pixels. Screenshots at 1366px and 390px were visually inspected. Structural/overflow checks cover all ten widths. Real Android/iPhone testing was not performed.

The browser used a disposable MongoDB replica set and separate frontend/API ports. Its fixtures contained 23 synthetic loans and zero payments or settlements; no configured database sample data was created. The configured MongoDB was not used for browser mutations. Test fixtures and their financial fingerprints remained unchanged during UI verification.

The first test run found two test-expectation mismatches (the existing date preference format and Express's literal bracket-key parsing); both expectations were corrected and the affected checks rerun. A genuine UI conflict with the global white header style was fixed in route-scoped CSS and rechecked visually. All final checks pass.

## Remaining verification

No known failing application checks remain. Loading/error/empty-database states were tested through component rendering; no live network outage or emptying of the database was performed. The browser exercised populated employee options but not a roster larger than 100. Check phone date pickers and comfortable tapping on a real device. At 768px and 1024px the table intentionally has contained horizontal scrolling; the page itself does not overflow.

To accept: open Admin > Loans, search a real loan/customer/mobile, combine filters, test the issue-date range, Reset Filters, change page size, open View Details, and check the Issue Loan customer-selection path. The normal site remains at `http://localhost:5173/admin/loans`.
