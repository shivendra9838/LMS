# Employee Targets & Customers summary fix

The dashboard previously paginated individual installment projections. The same customer appeared once per installment, and filter counts represented installments. Targets & Customers now consumes an additive customer-summary projection from the existing employee workspace API. Other installment/timeline response fields and payment APIs remain available unchanged.

## Behavior

- One row/card per currently assigned customer, including customers without loan schedules. Search matches name, customer code, mobile and any servicing loan number.
- Previous overdue and date dues use actual remaining allocation-based balances from the existing Asia/Kolkata projection. Total due/remaining are their sum. Received is actual employee receipts on the selected date, counted once at each receipt's primary allocation; it is not blindly subtracted from scheduled dues.
- Counts/pagination are unique customers. Due Today includes customers with an active scheduled installment on the selected date, even if covered, plus customers with unpaid prior overdue. Paid means all installments due through the selected date are covered; future-only/no-loan customers are not labelled paid.
- Multiple loan balances combine in one customer summary and expand into loan/individual installment breakdowns with exact History and View Loan links.
- Collect opens the existing Record Payment modal. Its existing server quote prefills the selected loan's actual minimum and shows its allocation preview. For multiple eligible loans, a loan selector preserves separate loan receipts and the existing single-loan allocation API; the customer total remains visible. Existing loan issuance restrictions remain unchanged.
- Historical dashboard labels use actual allocated receipt completion dates: Overdue Paid, Paid On Time, Paid in Advance, and Partially Paid — Overdue. The shared late-payment display label also reads Overdue Paid. Original dates/status codes and amounts are unchanged.
- Mobile uses compact cards, wrapped filters, full-width Collect and expandable loan details. Desktop keeps a compact table with contained table scrolling where necessary.

## Changed files

Backend: `src/services/employeeDashboard.service.js`, new `src/utils/customerCollectionSummary.js`, `src/utils/installmentStatus.js`, new `tests/unit/customerCollectionSummary.test.js`, `tests/integration/dashboardFinance.integration.test.js`.

Frontend: `src/components/dashboard/EmployeeWorkspace.jsx`, `employeePresentation.js`, `employee-workspace.css`, `employee-mobile.css`; `src/pages/employee/Dashboard.jsx`; `src/components/collections/RecordPaymentModal.jsx`, `PaymentReviewModal.jsx`; tests `employeeWorkspace.test.mjs`, `mobileEmployeeDashboard.test.mjs`, `employeeDashboard.test.mjs`, `installmentSequence.test.mjs`.

## Executed checks

- Full backend run: 44 suites, 387 tests passed, coverage gates passed. Final focused summary/dashboard run: 14 tests passed, including the final Due Today semantics.
- Frontend: 200 tests passed, ESLint passed, production build passed.
- Ninety synthetic installments / two customers / multiple loans produce two summaries. Exact ₹2,700 + ₹700 = ₹3,400, partial paise balances, paid advances, shared receipts, zero-due customers, search, permissions, unique counts and read-only financial preservation are covered.
- Browser on disposable MongoMemoryReplSet: two customers with 60 schedules produce two rows/cards; code search narrows to one; Paid (0) produces the correct empty state. Collect ₹1,300 opens the original modal with ₹600 previous overdue + ₹700 today; server preview allocates ₹600 and ₹700 to their actual installments. No browser payment was submitted.
- Measured widths: 320, 375, 390, 430, 768, 1024, 1366 and 1920px. No horizontal page/card overflow; the 320px payment dialog measured 304px wide and 765px tall within an 850px viewport. Expanded mobile breakdown works. No application console errors observed.
- Browser fixture financial/source hash remained unchanged. No test data was written to configured Atlas. No customer, installment, payment, loan balance or settlement records were repaired/reset/rewritten.

Screenshots: `screenshots/customer-summaries/desktop-1366.jpg`, `screenshots/customer-summaries/mobile-390.jpg`.

## Manual verification

Open Employee Dashboard → Targets & Customers, check All Customers count, search by customer ID/loan number and open Breakdown. Tap Collect, review the server-provided date/minimum/allocation before recording a real receipt. A multi-loan customer requires separate loan receipts using the selector. Verify refresh and actual receipt history after authorized payment entry. Physical-phone testing and production payment submission were not performed.
