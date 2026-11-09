# Employee dashboard financial and responsive update

## Verified configured data

Read-only Atlas checks found one assigned active customer and one assigned loan. The original COL000005 receipt is ₹800, actually received on 28 October 2026 (Asia/Kolkata), allocated ₹700 to Day 2 and ₹100 to Day 3. Therefore 29 October's ₹700 scheduled / ₹0 received / ₹600 remaining is correct. Selecting 28 October shows the full ₹800. No configured records were repaired, seeded, deleted or rewritten. Before/after customer, loan, installment and receipt snapshots matched exactly.

## Changes

- Shared collection performance calculations distinguish scheduled coverage, full actual receipts, advance allocations and remaining balances. Receipt IDs are deduplicated, actual received business dates drive cash totals, and positive valid receipt statuses are authoritative. Invalid/voided/reversed legacy receipt references cannot silently regain credit through stale schedule totals; discrepancies are flagged for reconciliation without altering records.
- Same-day loan payoff retains that day's scheduled target. Previously completed loans do not create later targets. Admin and Employee performance reuse the shared projection.
- Employee workspace includes all authorized servicing loans, aggregate customer/loan counts, contextual search/filter counts, pagination, a loan selector and full receipt/allocation breakdowns. Profile links respect current customer access separately from loan servicing access.
- A receipt covering several installments contributes its full cash amount once at its primary installment; each row separately displays its allocation. Receipt shortcuts open the latest relevant receipt. Exact-installment history and full loan history remain distinct.
- Timeline, target breakdown, trend, payment tracking and activities clarify receipt received date versus system entry date. Admin review and company settlement remain separate. Unmapped funds are visible rather than silently discarded.
- Dark/gold compact layout, responsive customer cards, two-column small-phone KPIs, mobile header/menu, accessible dialogs, existing secure photos, date controls and collection actions are reused.

## Files

Backend:
- `src/services/collectionPerformance.service.js`
- `src/services/employeeDashboard.service.js`
- `src/services/customerPaymentReview.service.js`
- `src/services/paymentNotification.service.js`
- `src/services/notificationSearch.service.js`
- `tests/unit/collectionPerformance.test.js`
- `tests/integration/dashboardFinance.integration.test.js`

Frontend:
- `src/pages/employee/Dashboard.jsx`
- `src/components/dashboard/EmployeeWorkspace.jsx`
- `src/components/dashboard/FinancialBreakdown.jsx` (new)
- `src/components/dashboard/employeePresentation.js`
- `src/components/dashboard/employee-workspace.css`
- `src/layouts/PortalShell.jsx`
- `tests/dashboardFinance.test.mjs` (new)

No schema migration, new financial posting API, dependency, loan calculation change or configured-database financial write was required. Existing uncommitted work was preserved.

## Executed verification

- Backend: **38 suites, 323 tests passed**, including full coverage gates.
- Frontend: **99 tests passed**.
- ESLint: **passed**.
- Production build: **passed**, written to isolated `tmp/dashboard-finance/build` so preexisting dist changes were preserved. Vite correctly notes this output directory is outside the frontend root and is not emptied.
- Added regression coverage: multiple customers, 700/800/100/600 reconciliation, partial receipts, duplicate receipt IDs, mixed receipts, backdated received versus entry dates, overdue allocation, future-date exclusion, same-day payoff, Admin review/settlement separation, invalid imported receipt references, ownership, empty portfolios, exact receipt selection and financial breakdown rendering. Existing posting, settlement, permission and sequence tests also passed in the full suite.
- Browser tests used only a disposable MongoDB Memory replica set and separate frontend/API ports. Three assigned customers generated target ₹2,100, initial prior coverage ₹100 and remaining ₹2,000. Recording a real test ₹800 receipt allocated ₹600 to today's remaining installment and ₹200 to the next. Dashboard then showed target ₹2,100 / actual ₹800 / remaining ₹1,400. Exact history showed ₹100 + ₹600 on Day 3; the original ₹800 receipt retained its ₹700 + ₹100 allocations.
- Historical date selection showed ₹800 actual on 28 October, separate from entry on 29 October. Mobile menu, customer search, due filter, collection preview/save, receipt and exact-installment history were exercised. No console errors were captured.
- Browser viewport overflow checks passed at **320, 360, 375, 390, 430, 480, 768, 1024, 1366 and 1920px**. KPIs retained two columns on small phones. Desktop tables have intentional contained horizontal scrolling; mobile uses cards.
- Local backend restarted successfully with MongoDB connected; frontend returned HTTP 200 and unauthenticated protected API returned HTTP 401.

Screenshots under `docs/screenshots/dashboard-finance/` contain disposable synthetic data only: desktop.png, mobile.png, installment-breakdown.png.

## Limits and manual checks

No physical Android/iPhone was tested. Verify touch scrolling, keyboard behavior, camera/file permissions and orientation on actual devices. Large-portfolio load performance was not benchmarked. This work handles invalid imported receipt statuses defensively; it does not introduce a reversal API or migrate historical records. Old reminder activities remain historical events, while current balances come from the ledger.

Open Employee → Dashboard, select 28 October to check the original ₹800 receipt, then 29 October to inspect ₹100 advance / ₹600 remaining. Open Day 2's breakdown and exact receipt; open Day 3's history to see only its ₹100 allocation. Use actual employee data for counts, never reference-image sample numbers. Admin receipt review and settlement verification must continue through their separate existing screens.
