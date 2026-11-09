# Admin Customer Details redesign

Implemented 4 November 2026 for /admin/customers/:id from the supplied desktop/laptop/mobile reference. Existing uncommitted work was preserved.

## All eight sections

| Section | Implemented behavior |
|---|---|
| Overview | Compact loan, outstanding, overdue, recorded-collection and overdue-count cards; next unpaid installment and portfolio summary. No inferred legacy receipt totals. |
| Personal & Contact | Grouped personal/contact/address information, masked identity reference and existing Edit Profile/KYC revision navigation. Profile details are not duplicated inside a second photo header. |
| Approved KYC & Documents | Approval, current review and approval timestamp, with the existing authorized KYC workspace for complete form, private documents, PDF and print. No replacement KYC workflow. |
| Loan Accounts | Responsive loan cards with principal, interest, payable, saved paid/remaining amounts, dates, overdue, servicing employee and existing Loan Details. |
| Installment Schedule | All/Today/Overdue/Paid/Upcoming/Advance filters, controlled desktop table scrolling and expandable mobile cards. Exact remaining balances, receipt dates, allocation history and original sequence-lock explanations. |
| Payments & Collections | Transaction cards with receipt, amount/method, collector, actual receipt versus system entry dates, backdate reason, expandable allocations and existing receipt/print navigation. Missed/waived/zero-receipt entries are identified separately. |
| Overdue & Advance | Overdue summary, remaining amount in the selected server-filtered view, partial rows, advance allocation evidence and existing restrictions. No new Collect Payment action. |
| Timeline & Audit | Compact newest-first recorded timeline with event icons, available category/role, timestamps, original details and server pagination. |

The customer header includes protected photo preview/edit controls, identity/status, linked employee portfolio, breadcrumbs/back links, shared authoritative risk badge/details, existing Edit/Reassign/Issue Loan/Activate/Deactivate actions and refresh. Status changes now have a confirmation dialog. Reassignment retains its existing reason, active-employee validation, compare-and-swap assignment and audit workflow.

Desktop uses wrapping icon navigation. Mobile uses one accessible section selector, a compact action grid, centered original branding, hamburger and notification bell. All selected tab/filter/page state is in the URL and survives refresh/back navigation. Existing notification/focus/15-second refresh is reused without discarding loaded content during background reads.

## Read-only API additions

- GET /api/v1/customer-portfolios/customers/:id: adds totalCollected, recordedReceiptCount and nextInstallment. Recorded receipts reuse collectionPerformance.validReceipt and existing money helpers; saved loan paid balances are not substituted for missing receipt records.
- GET /api/v1/customer-portfolios/customers/:id/installments: preserves original scopes and adds PAID and ADVANCE scopes, filtered total remaining, and the existing allocation-aware review decoration.
- The ADVANCE filter checks real early receipt allocations, including legacy primary-installment evidence. An early partial allocation remains visible after a later receipt completes the installment. Dates use Asia/Kolkata.

No mutation API contract, financial calculation, allocation/collection eligibility rule, database schema, index migration, KYC snapshot or authentication permission was changed. The shared installment query changes are optional read filters; existing callers without those options retain their behavior. No records were migrated or repaired.

## Files changed

- frontend/src/pages/admin/CustomerDetails.jsx
- frontend/src/components/customers/CustomerDetailSections.jsx (new)
- frontend/src/components/customers/customerDetailPresentation.js (new)
- frontend/src/components/customers/admin-customer-details.css (new)
- frontend/src/layouts/PortalShell.jsx
- frontend/tests/adminCustomerDetails.test.mjs (new)
- backend/src/services/customerPortfolio.service.js
- backend/src/routes/customerPortfolio.routes.js
- backend/src/repositories/collection.repository.js
- backend/tests/integration/customerPortfolios.integration.test.js

## Executed checks

- Frontend lint: PASS.
- Frontend tests: PASS, 170 tests, 0 failures.
- Production build: PASS, tmp/admin-customer-details-ui/build.
- Full backend Jest run with coverage gates: PASS, 40 suites / 363 tests.
- All eight tabs: PASS browser rendering/navigation at 320, 360, 375, 390, 430, 768, 1024, 1280, 1366, 1440 and 1920px (88 tab/width measurements). No page overflow, out-of-viewport controls outside the explicitly scrollable table, or application error panels.
- Additional final profile/header checks: PASS at the same 11 widths, including 44px button targets, mobile branding and no overlapping controls.
- Partial history: PASS. An isolated 800 receipt appeared as 700 for Day 1 and 100 for Day 2; Day 2 showed 600 remaining. Unpaid Day 3 onward had no Installment History button. Full loan history remained accessible.
- Paid and advance filters: PASS. Paid returned the correct fixture row; no early allocation correctly gave an empty advance view. Added backend regression verifies early 100 plus later 600 still appears in ADVANCE with final Paid Late status and both original allocations.
- Timeline: PASS, 20 events on page 1 and 5 on page 2. Timeline selection and page retained after reload.
- Photo: PASS, authorized blob image loaded at its real 360 x 460 dimensions with object-contain in the preview; zoom reached 150%, Escape closed it. The list/header thumbnail remains circular with object-cover.
- Actions: PASS opening/cancelling status confirmation, loading active reassignment options and enforcing mandatory reason without saving a reassignment. Existing backend reassignment and authorization regressions passed.
- Existing secure KYC route: PASS, Customer KYC Form rendered with complete application, PDF, print and protected document actions. Existing receipt route: PASS, PAYMENT RECEIPT rendered. Neither workflow was rewritten.
- Mobile drawer: PASS open/close. Fresh page reload: 0 console errors.
- Local normal backend restarted to load the read-only updates. MongoDB connection and /api/v1/health verified successfully; normal frontend remains on port 5173.

New regressions also cover URL navigation, missing money versus real zero, exact-installment history evidence, masked identity, receipt/due dates, upcoming labels in Asia/Kolkata, missed-payment markers, waivers and customer/employee permissions. Existing financial fingerprint checks passed before/after portfolio reads and controlled test reassignment.

Logs: tmp/admin-customer-details-frontend-tests.log, tmp/admin-customer-details-backend-tests.log, tmp/admin-customer-details-build.log. Measurements: tmp/admin-customer-details-ui/responsive-checks.json and header-checks.json.

## Screenshots

All screenshots use only disposable synthetic fixture data:
- docs/screenshots/admin-customer-details-ui/overview-1440.jpg
- docs/screenshots/admin-customer-details-ui/overview-1366.jpg
- docs/screenshots/admin-customer-details-ui/overview-390.jpg
- docs/screenshots/admin-customer-details-ui/loans-1440.jpg
- docs/screenshots/admin-customer-details-ui/installments-mobile-390.jpg

## Safety and remaining acceptance

Browser verification reused the existing isolated fixture on MongoMemoryReplSet database admin_customer_details_disposable, API 5017/frontend 5187. Regression data was confined to disposable test databases. No customers, loans, payments, assignments, KYC decisions or financial history in the configured database were edited by this work. No production sample data was seeded. The temporary browser tab was closed, viewport override reset and disposable servers shut down after verification.

No known application failure remains in executed checks. Authenticated browser acceptance against the configured database, physical Android/iPhone operation, hardware keyboard behavior and physical printer output were not verified. PDF/print actions retain their existing workspace and generator; no new physical printing claim is made.

Manual acceptance: refresh Admin > Customers, open an employee portfolio and View Details. Switch all eight sections, compare displayed values to the existing loan/receipt history, try the Paid/Overdue/Upcoming filters, open a specific installment history, preview the uploaded photo and follow the existing KYC/receipt links. On a real phone, check the section selector, drawer, expandable cards and bottom navigation. Only save a status/reassignment or issue a loan when you intend that business action.
