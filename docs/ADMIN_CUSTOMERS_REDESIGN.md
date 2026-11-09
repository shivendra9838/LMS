# Admin Customers and Add Customer redesign

Implemented 4 November 2026. Existing uncommitted work preserved.

## What changed

- Admin > Customers retains the employee portfolio directory, all customer/unassigned/risk links, server-side search, branch/status filters, sorting and pagination. Six summary cards use existing API totals.
- Navy/black panels, gold actions, compact icons, employee status, circular private employee photos or initials, portfolio statistics and name/View Customers navigation. Mobile secondary filters collapse without unmounting their controls or losing selections.
- Admin > Customers > Add Customer retains all 14 existing fields, their required/optional rules and request payload. Desktop uses independently stacked sections in two columns; mobile uses one column. Inline accessible errors, first-invalid-field focus, active employee loading/error/empty states, save lock, and navigation to the selected employee portfolio on success.
- Shared employee photo viewer now includes zoom/reset and existing Close/Escape/backdrop support. All/unassigned/employee customer portfolios use the existing protected customer photo preview and retain separate name/code/detail navigation and authoritative risk badges.
- Mobile pagination and form actions have clearance above the existing bottom navigation.
- Minimal read-only API enhancement: GET /api/v1/customer-portfolios adds hasPhoto metadata for employees on the requested page. No photo bytes, private URLs, schema changes or mutation API changes.

## Risk investigation

A fresh read-only inspection of loan_management on 2026-11-04 (Asia/Kolkata) confirmed shivendra: REVIEW_REQUIRED, established score 67. The customer saved as Abhiskeh Bhaskar: REVIEW_REQUIRED, UNRATED, score null. Both assignments match their loan servicing employee and the Employee batch API includes both assessments. A review requirement and a withheld numeric score can coexist. The shared renderer preserves Review Required / Not Rated Yet instead of inventing a score. No risk thresholds, financial calculations or saved audit snapshots were changed.

## Files changed for this task

- frontend/src/pages/admin/Customers.jsx
- frontend/src/pages/admin/AddCustomer.jsx
- frontend/src/pages/admin/CustomerPortfolio.jsx
- frontend/src/layouts/PortalShell.jsx
- frontend/src/components/CustomerForm.jsx (opt-in Admin presentation; other forms retain existing rendering)
- frontend/src/components/CustomerPhoto.jsx (opt-in preview in customer identity)
- frontend/src/components/EmployeeAvatar.jsx
- frontend/src/components/customers/AdminCustomerFields.jsx (new)
- frontend/src/components/customers/customerFields.js (new)
- frontend/src/components/customers/admin-customers.css (new)
- frontend/tests/adminCustomers.test.mjs (new)
- backend/src/services/customerPortfolio.service.js
- backend/tests/integration/customerPortfolios.integration.test.js

## Executed verification

- Frontend lint: PASS.
- Frontend node tests: 159 passed, 0 failed.
- Frontend production build: PASS; output tmp/admin-customers-ui/build.
- Full backend Jest run including coverage gates: 40 suites, 360 tests passed. Disposable MongoDB only. Existing portfolio tests include financial fingerprints, permissions, assignment, filtering and pagination; added private-photo metadata/employee denial regression.
- Browser: 22 final layout checks (directory with expanded secondary filters + Add Customer) at 320, 360, 375, 390, 430, 768, 1024, 1280, 1366, 1440 and 1920px. No page overflow or out-of-viewport form/filter controls.
- Browser interactions in isolated admin_customers_disposable MongoMemoryReplSet on API port 5017/frontend 5187: Admin login, six API summary totals, search, empty inactive filter, sorting, page 1 -> page 2, employee portfolio navigation, required-field errors, one successful customer creation with chosen EMP0002 assignment and CUS000004 generation, protected employee/customer photo loading, zoom, Escape and backdrop dismissal, mobile drawer open/close, filter selection retention, mobile save button unobstructed by bottom navigation.
- Fresh directory reload: 0 console errors.
- Normal local backend restarted to load the metadata update; MongoDB connection and /api/v1/health returned success. Existing frontend remains on port 5173.

Screenshots (synthetic data only): docs/screenshots/admin-customers-ui/directory-1440.jpg, directory-390.jpg, add-1440.jpg, add-390.jpg. Responsive measurements: tmp/admin-customers-ui/responsive-checks.json. Test logs: tmp/admin-customers-{frontend-tests,backend-tests,build}.log.

## Safety and remaining acceptance

No configured MongoDB customer, employee, KYC, financial or assignment records were edited. The only configured database inspection was read-only risk comparison. Creation and fixture records were confined to disposable MongoDB, then its server was shut down. No new application schema/index migration or financial repair was performed.

Authenticated browser acceptance against the configured database was not performed because no Admin session was supplied. Physical Android/iPhone testing and real on-screen keyboard behavior were not performed; the viewport checks are browser simulations. No known application error remains from these checks.

Manual check: refresh the normal site; Admin > Customers, search an employee, expand Filters & sorting on mobile, open View Customers, preview a saved photo, and open Add Customer. Confirm personal/contact/assignment/identity sections, optional fields, validation, and Cancel. Save only when intentionally creating a real test customer. Check on an actual Android device that keyboard and bottom navigation leave actions accessible.

