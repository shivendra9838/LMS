# Admin Employees redesign

Implemented the two supplied references in the existing React application. The Employees list, Add Employee, Edit Employee and Employee Details now share a scoped navy/black and gold theme, compact cards, Lucide icons, aligned fields and responsive layouts. Original branding, navigation, bell and account actions remain available.

## What changed

- Directory: four real workforce totals, prefix search across name/code/email/mobile, status filtering, Refresh, pagination, desktop contact/location/joining-date table and mobile employee cards. Rows support mouse and Enter/Space; independent action buttons do not trigger duplicate row navigation.
- Add/Edit: shared labeled fields, two desktop columns and one mobile column, numeric phone keyboard, native date input, inline validation, server error messages, loading states and a submission lock. Only the existing six onboarding fields are required. Edit keeps the existing editable fields and dependency-protected status change. Successful creation retains the original one-time login credential flow and hides the creation form to prevent accidental repetition.
- Employee profile: actual secured photograph or circular initials, status, code, contact and joining date, Edit and Customer Portfolio links. Photo opens an authenticated blob preview with original aspect ratio, X, Escape and backdrop dismissal. Object URLs and requests are cleaned up.
- Overview: existing employee information and financial summary, plus dependency checks and existing action links.
- Assigned Customers: reuses the existing customer portfolio, photos, KYC/status, loan balances, risk details, search, sorting, filters and pagination. On mobile, secondary filters collapse without losing their values.
- Loans: actual paginated employee-specific API records, search, status filter and loan detail links.
- Activity: paginated existing audit events performed by the selected employee or explicitly referencing their account. Sensitive audit payloads remain excluded.
- Dependencies: existing active-loan, outstanding-custody-position and unresolved-settlement checks, plus employee account requests. Custody counts are explicitly not rupee balances. Deactivation checks were not bypassed.
- Fixed two response-envelope mismatches found during QA and a 320px currency wrapping issue. Theme CSS is loaded with the portal shell so the employee module retains its dark loading state.

## Small backend changes

No schema migration or financial calculation changed.

1. Existing Admin-only `GET /api/v1/admin/dashboard` additionally returns `joinedThisMonth`, counting joining dates in the current Asia/Kolkata calendar month. Totals cover the whole workforce, independently of list pagination and filters.
2. Existing `GET /api/v1/settings/activity` accepts an optional **Admin-only** `employeeId` filter. Invalid IDs are rejected; Employee attempts to use this Admin filter are forbidden. Returned rows still contain only action, role, module and timestamp metadata.
3. Employee creation validates an optionally supplied joining date through the existing validation middleware. Valid creation behavior is unchanged; invalid dates receive the existing HTTP 400 validation response.

Risk policy and scoring were preserved. Backend `REVIEW_REQUIRED` assessments with an unpublished score retain “Not Rated Yet.” Genuine `INSUFFICIENT_HISTORY` remains Insufficient History, and its risk modal says Not Rated Yet; it is not relabeled into a different decision category or assigned a fabricated score. Employee job titles not collected by the application were not invented from the mockup.

## Files modified or created

Paths below are relative to `C:/Users/shive/Desktop/LMS`.

- `frontend/src/pages/admin/EmployeeList.jsx`
- `frontend/src/components/EmployeeTable.jsx`
- `frontend/src/pages/admin/AddEmployee.jsx`
- `frontend/src/pages/admin/EditEmployee.jsx`
- `frontend/src/pages/admin/EmployeeDetails.jsx`
- `frontend/src/pages/admin/CustomerPortfolio.jsx` — optional embedded filter disclosure; full portfolio functionality retained
- `frontend/src/components/EmployeeAvatar.jsx`
- `frontend/src/components/employees/EmployeeUi.jsx` — new shared presentation and form fields
- `frontend/src/components/employees/presentation.js` — new validation, response normalization and accessible row helpers
- `frontend/src/components/employees/employees.css` — new scoped module/shell styles
- `frontend/src/layouts/PortalShell.jsx`
- `backend/src/repositories/employee.repository.js`
- `backend/src/services/settings.service.js`
- `backend/src/validators/employee.validator.js`
- `frontend/tests/adminEmployees.test.mjs` — new regression tests
- `backend/tests/integration/settings.integration.test.js` — added regressions; synthetic fixture IDs now use normal EMP numbering
- This report and `docs/screenshots/admin-employees-ui/`.

Existing unrelated uncommitted work was retained. No package dependencies were added.

## Executed verification

| Check | Result |
| --- | --- |
| Full backend Jest suite with coverage | PASS — 39 suites, 355 tests |
| Focused settings/employee rerun | 21 tests passed; standalone command failed the project-wide coverage gate because only one module ran. Superseded by the complete suite with coverage unchanged. |
| Frontend tests | PASS — 150 tests |
| Frontend ESLint | PASS |
| Vite production build | PASS — output in `tmp/admin-employees-ui/build` |
| Normal backend startup / MongoDB connection | PASS — MongoDB Connected; port 5000 health OK |
| Normal frontend availability | PASS — `/admin/employees` on port 5173 returns HTTP 200 |
| Responsive DOM checks | PASS — 45 page/viewport combinations, no horizontal page overflow |
| Long currency KPI values | PASS — no broken amounts at tested widths after the 320px fix |
| Directory search, status and empty state | PASS — disposable browser fixture |
| Employee list pagination and Enter navigation | PASS — disposable browser fixture |
| Add Employee and normal next EMP code | PASS — disposable fixture generated EMP0013; one-time creation form completed |
| Invalid phone entry | PASS — blocked in browser |
| Edit Employee | PASS — name persisted; employee code retained |
| Account-action confirmation | PASS — opened and cancelled without changing access |
| Assigned customers / risk modal | PASS — real fixture records, existing unscored history handling |
| Loans, Activity and Dependencies tabs | PASS — scoped records and correct empty states rendered |
| Secure photo preview | PASS — authenticated blob, actual 360×460 fixture image, contain fit, X/Escape/backdrop close, mobile bounds |
| Mobile drawer | PASS |
| Console after clean reload and checks | PASS — no new captured errors |
| Physical Android/iPhone testing | NOT VERIFIED — browser viewport testing only |

Widths: **320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px**. Checked list, Add, Edit, Details and embedded Assigned Customers. Tables use controlled horizontal scrolling on tablet where needed; mobile employee/customer records use cards. Detail tabs scroll within their own navigation strip.

Backend tests and browser fixtures use disposable MongoMemoryReplSet databases. Browser creation/editing happened only on the fixture API at port 5017, with a separate fixture frontend at port 5187. No employee creation, edit, customer/loan/payment/settlement mutation, deletion, reset or migration was submitted to the configured Atlas database. No configured employee IDs or customer assignments were changed. The existing employee-number generator was not changed. Disposable fixture servers were stopped after testing; the normal website remains running.

Initial QA failures were corrected and rerun: API payload handling, a test expectation inconsistent with the application's existing HTTP 400 validation middleware, a fixture ID-format mismatch, and currency wrapping. The focused-only rerun also failed global coverage, so the entire backend suite was rerun with the original coverage gate. No tests or coverage requirements were removed or bypassed.

## Screenshots

All screenshot values and photographs are synthetic QA data, not live business records.

- `docs/screenshots/admin-employees-ui/list-desktop-1440.jpg`
- `docs/screenshots/admin-employees-ui/list-mobile-390.jpg`
- `docs/screenshots/admin-employees-ui/add-desktop-1440.jpg`
- `docs/screenshots/admin-employees-ui/add-mobile-390.jpg`
- `docs/screenshots/admin-employees-ui/details-desktop-1440.jpg`
- `docs/screenshots/admin-employees-ui/details-mobile-390.jpg`
- `docs/screenshots/admin-employees-ui/customers-mobile-390.jpg`

## Manual acceptance

1. Refresh `http://localhost:5173/admin/employees` once to load the latest theme.
2. Check workforce totals, search, Active/Inactive filters, pagination, row/photo/name navigation and independent actions.
3. Open Add Employee or Edit Employee and inspect validation and responsive layout. Only submit a real account change when intended; creation still provides the existing one-time credential.
4. Open an employee profile and test the photo preview, five detail tabs, customer risk/details links and Customer Portfolio navigation.
5. Check the actual phone date picker, keyboard, scrolling and bottom navigation on an Android device. Native date input display order follows the browser locale; list and detail dates retain existing portal preferences and IST handling.

No unresolved automated failures remain. Physical-device behavior and account-specific live data require your acceptance review.
