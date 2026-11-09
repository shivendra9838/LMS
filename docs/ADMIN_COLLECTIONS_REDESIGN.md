# Admin Collections & Installments redesign

Implemented on the existing `/admin/collections` route. The reference was used for visual direction; the written instruction prohibiting direct Admin payment collection takes precedence over the mockup's Record Collection button.

## Improvements

- Compact Royal Enterprises black-and-gold header, original sidebar/header/logo/notifications/profile/navigation retained.
- Today, Overdue, Upcoming and All Installments tabs with server-derived counts. Counts respect the applied search, employee and payment-allocation filters.
- Four compact summaries for the complete matching list: expected installment amount, allocated payments, remaining unpaid and installment count. They do not sum only the current page.
- Search customer name, code, loan number or mobile; employee and full/partial/unpaid filters; Apply and Reset; page sizes 10/20/50/100.
- Desktop table with customer/loan, installment day, due date, expected, allocated paid amount, remaining, authoritative payment timing/status and original actions.
- Phone cards replace the table below 768px, with expandable filters and allocation breakdowns. Tablet/narrow laptop tables have contained scrolling where required for eight columns.
- Exact installment History and underlying receipt review are reused. A multi-installment receipt's full amount is clearly separated from the allocation for the current installment. Receipt links open the existing protected receipt route.
- Unpaid rows show Awaiting Employee Collection and an explanatory message on activation. No History appears without recorded allocations. Locked rows have an expandable lock explanation identifying the earlier due and remainder. Recorded and verified states remain distinct.
- Existing review modal, permissions, remarks, receipt verification endpoint and company-settlement separation remain intact. Admin has no Record Collection/Collect Payment action.
- Loading, empty and recoverable error states; stale request cancellation; automatic refresh retained. Background refresh keeps the current table in place. Stable modal callbacks preserve unsaved remarks and keyboard focus during refresh.

No export button was added: the existing installment-list flow does not provide a matching export contract that preserves these filters and allocation semantics. No actual-collected-today card was inferred from installment allocations. A receipt received today may fund several due dates; the list instead labels its metric Allocated payments and explains the difference.

## Files

Created:
- `frontend/src/components/collections/AdminCollections.jsx`
- `frontend/src/components/collections/AdminInstallmentPresentation.jsx`
- `frontend/src/components/collections/admin-collections.css`
- `frontend/tests/adminCollectionsUi.test.mjs`

Modified:
- `frontend/src/pages/employee/TodayCollections.jsx` — existing Admin route delegates to the new Admin presentation; Employee presentation and payment modal remain intact.
- `frontend/src/components/collections/InstallmentActions.jsx` — optional compact lock presentation; Admin awaiting action for locked unpaid rows; unrecognized review states cannot open verification. Employee collection action is retained.
- `frontend/src/layouts/PortalShell.jsx` — exact Admin collections route styling and preserved shell.
- `backend/src/services/collection.service.js` — validated optional allocation-state filter and read-only tab count orchestration.
- `backend/src/repositories/collection.repository.js` — mobile-number search and integer-paise summaries within existing aggregation/pagination. Existing scope classification and eligibility are retained.
- `backend/tests/integration/customerPaymentReview.integration.test.js` — regression for cross-page totals/counts, search, filters, authorization and read integrity.

Report: `docs/ADMIN_COLLECTIONS_REDESIGN.md`. Screenshots: `docs/screenshots/admin-collections-ui/`.

## Read-only API additions

Existing authenticated `GET /api/v1/collections/installments` supports:

- `includeSummary=true`: returns counts for the four existing scopes.
- `paymentState=PAID|PARTIAL|UNPAID`: optional filter based on saved installment allocation values; invalid values return 422.
- Existing `search` additionally searches authorized customer mobile numbers.
- Paginated responses additionally include `summary.amount`, `summary.paidAmount`, `summary.remainingAmount`, `summary.total`, and authorized row `customerMobile`.

The summary uses existing minor-unit aggregation helpers. Expected and paid amounts are summed from schedules; remaining uses the pre-existing nonnegative amount-minus-allocation rule. Scope semantics, financial records, actual receipt dates, loan balances, payment allocation and verification rules were not changed. Employee queries remain constrained to their own servicing assignments. No new write API or schema migration was introduced.

## Executed verification

| Check | Result |
|---|---|
| Frontend lint, final run | PASS |
| All frontend tests, final run | PASS: 183/183 |
| Production build, final run | PASS |
| Full backend suite with existing coverage gates | PASS: 40 suites, 366/366 tests |
| Four tabs at thirteen widths | PASS: 52 checks; no page overflow or checked card/filter text overflow |
| Expanded phone filters | PASS: all six phone widths |
| Search customer name/code/loan/mobile | PASS in browser |
| Employee + partial-allocation filter | PASS: matching installment and whole-list totals |
| Pagination | PASS: next page 11–20 of 30; page sizes 10 and 100 exercised |
| Empty results and Reset | PASS in browser |
| Error/Retry/recovery | PASS: intentional disposable API outage showed connection error and Retry; existing automatic refresh recovered after restoration |
| Paid on time and Verified | PASS: existing verified receipt remains separate from settlement verification |
| Late/partial history | PASS: Day 2 shows allocation 100 and remainder 600; full receipt 800 and its Day 1 allocation 700 are separate |
| Advance history | PASS: two future installments each show their 700 allocation from one 1400 receipt |
| Unpaid/no History and locked rows | PASS: awaiting message and exact earlier-installment lock explanation |
| Verify Payment | Existing receipt review opens; underlying receipt and allocation are correct. Browser review was cancelled without submission; write permissions/idempotency are covered by backend integration tests |
| Mobile history dialog | PASS at 320x800: width 303, height 651, no page overflow, Escape closes |
| Unsaved review during refresh | PASS: remarks and textarea focus retained; no verification submitted |
| Mobile navigation | PASS: drawer/profile menu, Escape dismissal |
| Financial display | PASS: 100 checked installment rows matched API expected/allocated/remaining/status values |
| Financial preservation | PASS: disposable before/after fingerprints unchanged for customers, loans, schedules, receipts, positions, settlements, cashbook and payment reviews |
| Console | No errors in final clean runtime check; intentional outage produced expected test-only network errors earlier |
| Local backend | Restarted to load read-only additions; MongoDB connected, health OK |

Widths: 320, 360, 375, 390, 430, 480, 768, 1024, 1280, 1366, 1440, 1600, 1920 CSS pixels. Screenshots at 390, 768, 1366 and 1440 were visually inspected. At 768px the table scrolls within its own container; the page does not overflow. Wider/narrower structural checks covered all thirteen widths. No real-device testing is claimed.

The isolated browser fixture used a disposable MongoDB memory replica set. Its four synthetic loans, four receipts and one baseline verification were created only there. The configured Atlas database was not used for browser writes or sample data. All saved financial fixture fingerprints remained unchanged during browser checks. No production financial record was deleted, reset or repaired. Existing uncommitted work was preserved.

## Manual acceptance and limits

1. Open Admin > Collections & Installments on the normal site.
2. Check Today includes paid and unpaid, Overdue includes only unpaid overdue balances, Upcoming includes paid advances, and All shows history.
3. Search a real customer/code/loan/mobile, combine employee/status filters, then Reset.
4. Compare expected, allocated paid and remaining against a known installment. Check the full-list totals while changing pages.
5. Open History and allocation breakdown for a receipt covering more than one installment. Confirm its allocation is not confused with the full receipt amount.
6. Open and cancel an eligible customer-payment review. Perform an actual authorized review only after your own evidence check; company settlement review remains separate.
7. On a real phone, check native selects, mobile navigation and the history/review modal.

No known failing application checks remain. Actual phone testing and a roster larger than the first employee-options page were not exercised in the browser. Existing backend tests cover unauthorized and duplicate verification operations. Browser verification did not alter a payment-review record. No database setup or migration is required.
