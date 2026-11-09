# Shared Loan Timeline redesign

## Implemented

Admin → Loans → Loan Details → Overview and Employee → My Loans → Loan Details → Overview reuse LoanTimeline.jsx. The black/gold timeline has a common rail for 28px Lucide icons, thin connector and downward arrows. Dates use Asia/Kolkata. Titles and descriptions are compact and readable. Latest activity first is explicit; the latest five events appear initially, with View All Activity / Show Latest 5 Events controls and one natural page scroll.

Payment events come exclusively from the loan's actual Collection records: actual receipt total, mode, received timestamp and receipt ID. Historical PAYMENT_RECEIVED text entries are superseded in the read projection, not deleted or rewritten, so they do not duplicate real receipts or invent events for allocation-only advances. Existing loan and schedule lifecycle events remain sourced from LoanTimeline. Schedule description states the actual current saved installment count. Verification entries come from persisted CustomerPaymentReview records, separately from settlement; expanding them shows actual verifier, time, remarks and receipt reference. Stored reversal events are clearly labeled; no new reversal operation or financial event is fabricated.

Receipt events are complete clickable links to the existing role-specific receipt route. Schedule events open existing Collections with All scope and the current loan filter. Loan Created scrolls to the existing Financial Summary. Event ordering uses descending timestamp with a stable ID tie-break. Refreshes use the existing collection/inbox refresh hook. Loan ownership authorization runs before timeline queries; Employee review details reuse information already available through authorized receipt/history access.

Overview / Collection History tabs now wrap without negative margins or an overflow container, removing their small nested scrollbar. Mobile timeline follows the financial/party information; desktop keeps the existing right column.

## Files changed

- backend/src/repositories/loanTimeline.repository.js — read-only canonical activity projection and deterministic ordering; existing timeline write helper preserved.
- backend/src/controllers/loan.controller.js — pass already-authorized loan to the timeline query.
- frontend/src/components/LoanTimeline.jsx — shared accessible links, review disclosure, icons, times and show-all control.
- frontend/src/components/loan-timeline.css — aligned rail/arrows, compact black/gold styling, responsive wrapping and touch targets.
- frontend/src/components/LoanDetailsView.jsx — shared timeline integration, financial-summary anchor, wrapping tabs and existing refresh hook.
- backend/tests/unit/loanTimeline.test.js — authoritative receipt totals, duplicate suppression, stored reversal labels, deterministic order and missed/waiver exclusions.
- backend/tests/integration/customerPaymentReview.integration.test.js — both roles see real receipt/review activity; ownership denial, repeated read stability and no financial writes.
- frontend/tests/loanTimeline.test.mjs — role-specific exact receipt links, IST formatting, five-event limit, review details, schedule route, empty states and overflow regression.

## Executed verification

- Full backend: 36 suites, 294 tests passed; existing coverage threshold passed. Initial whole-rupee formatting failure fixed and full suite rerun successfully. Targeted test subsets were diagnostic only; their global coverage requirement is satisfied by the final complete run.
- Frontend: 77 tests passed. Initial assertion accidentally matched a technical CSS class instead of visible text, and a test URL import was missing; corrected and full suite rerun.
- ESLint passed.
- Production build passed, output tmp/loan-timeline/build-final, preserving existing tracked dist output.
- Disposable MongoMemory replica set: Employee login → My Loans → Loan Details; five visible events; View All expands six real test-database events; actual ₹700/₹800 receipt events; read-only verifier/remarks; exact ₹800 receipt click; Schedule action opens All Installments with LN000001 filter; Loan Created action scrolls to Financial Summary.
- Admin login → same authorized loan; matching facts and review details; correct Admin ₹800 receipt link opens the actual receipt. No browser console errors observed.
- Both portals measured at 320, 375, 390, 430, 768, 1024 and 1366 CSS pixels. Document widths do not exceed viewports, timeline scroll width equals client width, and tab scroll height equals client height. Rail icon/line x positions are consistent. Mobile/desktop screenshots visually inspected. Browser emulation, not physical device testing.
- Normal backend restarted and connected to MongoDB on port 5000. Frontend remains on port 5173. Disposable browser tabs and test servers were cleaned up.

## Data safety and limits

No existing customers, loans, installments, payments, schedules, settlements or timeline records were repaired, deleted or rewritten. No migrations or schema changes. A final native read-only Atlas comparison confirmed COL000005 amount ₹800, allocations ₹700/₹100 and original verification details unchanged. Test fixtures were restricted to a disposable database. Production receipt dates and amounts are read from the records, never copied from the request's illustrative timestamps.

Reversal presentation is tested with an isolated stored event; the application has no customer-payment reversal endpoint, and no real financial reversal was performed or added. Unlinked raw legacy payment descriptions are not used to infer missing receipts or amounts. Print/PDF generation is unchanged and was not re-tested for this timeline-only change.

## Manual check

Refresh http://localhost:5173. Employee → My Loans → LN000001 → Overview (or Admin → Loans → LN000001). Confirm one ₹800 receipt event for COL000005, one ₹700 receipt for the earlier collection, original stored times in IST, and distinct receipt verification. Click View Receipt, expand verification details, use View All Activity and View installment schedule. Resize the browser or use Android to confirm natural page scrolling and readable links.

Evidence: tmp/loan-timeline/admin-desktop.png, employee-mobile.png, viewport JSON and test/build logs.
