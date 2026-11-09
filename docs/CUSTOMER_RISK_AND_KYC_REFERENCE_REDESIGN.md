# Customer Repayment Risk and Customer KYC reference redesign

## Implemented

Employee → My Customers → Repayment Risk & Filters uses the existing `/employee/customers/risk` route. The shared Admin risk route remains supported. Dark navy surfaces, gold actions, compact summary cards, seven-column desktop table and accessible mobile cards follow the supplied reference. Search supports partial name, customer code and mobile matches. Apply Filters, Reset, customer status/category filters, mobile category chips, Back to customers, customer photo/name links, View Details and pagination use existing authorized records and routes.

Summary cards map Low Risk to the unchanged GOOD policy category, Moderate Risk to REVIEW_REQUIRED and High Risk to HIGH_RISK. Insufficient History remains separate and explicitly counted. No scoring thresholds, decision policy, financial balances or gauge implementation were changed. View Details opens the existing live repayment analysis modal.

Employee → Customer KYC uses the existing `/employee/customers/kyc` list and `/employee/customers/kyc/:id` form. All, Draft, Pending Approval, Approved and Rejected tabs show actual counts; Corrections Required is retained as an additional tab to preserve the existing workflow. Search, status dropdown, submitted-date range, Reset and pagination work against the server. Mobile filters expand from a filter button. Add New Customer KYC opens the existing new form. Drafts show View / Edit, rejected/correction records View / Revise, and pending/approved records View. The existing form continues enforcing revision permissions. No decorative three-dot menu was added because the existing list has no additional authorized actions.

Submitted/reviewed dates come from saved KYC history events, with existing approvedAt used only when review history is unavailable. Missing dates display a dash; updatedAt is never presented as a submission/review date. Filters use inclusive Asia/Kolkata business dates. Drafts with no submission date do not appear inside a submitted-date range.

Both lists reuse the same circular avatar adapter. Existing customers use CustomerPhoto and its protected display/KYC fallback. Applications without a customer use only their current PHOTO-kind document through the existing authorized encrypted document endpoint, rendered with a revocable blob URL. Identity documents and signatures are never used as avatars. No public storage URL, encrypted KYC payload or document bytes are included in list responses.

## Changed files

Frontend:
- `src/pages/shared/CustomerRiskDirectory.jsx`
- `src/pages/employee/KycList.jsx`
- `src/layouts/PortalShell.jsx`
- `src/components/directories/DirectoryUi.jsx` (new shared listing primitives, secure avatar adapter and read hook)
- `src/components/directories/directory.css` (new scoped desktop/mobile styles)
- `tests/customerDirectories.test.mjs` (new)

Backend:
- `src/services/customerRisk.service.js`
- `src/services/customerLead.service.js`
- `src/services/kycDirectory.service.js` (new read-only projection)
- `src/controllers/customerLead.controller.js`
- `src/validators/customerLead.validator.js`
- `tests/integration/customerDirectories.integration.test.js` (new)

## API changes

- Existing GET `/api/v1/customer-risk`: adds mobile substring search, validated ACTIVE/INACTIVE status filter, portfolio category counts, loan count, outstanding total and last valid received date. Assessments are processed in batches of 100 with the existing authoritative calculator; no cached/fabricated categories or frontend score calculation are introduced.
- Existing GET `/api/v1/customer-leads?listing=true&status=ALL`: opt-in minimal KYC listing projection with real status counts, event dates, customer code and PHOTO document identifier. Supports search, page/limit, status and submitted `startDate`/`endDate`. Existing callers retain the prior response behavior when listing mode is absent. Current Customer.employeeId authorizes linked KYC records; stale assignedEmployeeId cannot expose a reassigned customer's application. Unlinked drafts remain scoped to their submitter. Admin drafts remain excluded.
- No new write endpoints, dependencies, schemas, database migrations or financial posting changes.

## Executed tests and browser verification

- Backend: **39 suites / 327 tests passed**, full coverage checks included. New tests cover real status counts, current ownership versus stale assignment, unauthenticated denial, partial/mobile search, insufficient-history summary, pagination metadata, exact saved event dates, IST date boundaries, invalid ranges, minimal photo-only metadata and unchanged financial/KYC records.
- Frontend: **103 tests passed**. New tests cover KYC action states, missing dates, authoritative summary categories/percentages, secure avatar routes, pagination, loading/error retry and empty states.
- Frontend lint and production build passed. Build output is isolated under `tmp/customer-directories/build` to preserve preexisting dist changes.
- Browser tests used a separate MongoDB Memory replica set and separate local API/frontend ports. No test applications or customers were inserted into Atlas. Three risk customers and thirteen KYC records were used only in that disposable fixture.
- Risk: mobile-number partial search returned the exact customer; reset restored the portfolio; summary counts matched; desktop View Details and keyboard Enter on mobile cards opened the existing analysis modal; Back to customers returned to the existing directory.
- KYC: all thirteen fixture records were counted correctly; pagination showed records 11–13; Draft tab returned three drafts and reset pagination; partial-name search returned one draft; View / Edit opened the existing populated form with its PDF/print controls; submitted-date filtering excluded drafts without submission events. Protected PHOTO blobs loaded successfully.
- Both pages passed page-overflow checks at **320, 375, 390, 430, 768, 1024, 1366 and 1920px**. Desktop and 390px mobile layouts were visually inspected against the reference. Expanded KYC filters also fit 320px. Horizontal tab/chip scrolling and contained desktop-table scrolling are intentional.
- Read-only configured Atlas hashes for customer, KYC, document, submission, loan, installment, collection and settlement/cashbook records matched before and after verification. No configured financial or KYC records were modified.
- Normal frontend returns HTTP 200. Both protected listing endpoints return HTTP 401 without authentication. The normal backend was refreshed after tests.

Screenshots in `docs/screenshots/customer-directories/`: `risk-desktop.png`, `risk-mobile.png`, `kyc-desktop.png`, `kyc-mobile.png`. All visible entries in these screenshots are disposable test data.

## Remaining limits

No physical phone testing was performed. Check touch scrolling, native date pickers, portrait/landscape orientation and text scaling on the employees' actual Android browsers. Large-portfolio performance was not benchmarked; complete category counts require calculating all authorized customers in bounded batches. Older records without saved submission/review events correctly show blank dates rather than invented timestamps. Risk detail opening retains the application's existing assessment-audit behavior; financial/KYC data is not changed.
