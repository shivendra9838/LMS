# Customer repayment risk and behavior analysis

Implemented for Admin and Employee portals. This is decision support only: no loan approval, eligibility, customer status, payment posting, collection, settlement or balance calculation reads or acts on this score.

## Where to find it

- **Admin → Customers → Repayment Risk & Filters** (`/admin/customers/risk`). Search customer names/codes and filter Good, Review Required, High Risk or Insufficient History. Results are paginated on the server.
- **Employee → My Customers → Repayment Risk & Filters** (`/employee/customers/risk`). Only currently assigned customers are returned.
- Badges and **View Risk Details** appear in Employee customer cards/table, Admin customer portfolios, both customer detail pages, shared loan details/history, both loan issuance/review screens (including the existing active-loan warning), and both Overdue Follow-ups screens.
- The risk indicator remains visible when Admin opens a customer's Loan Accounts tab or either portal opens Collection History under loan details.
- There is no separate renewal/top-up request workflow in the existing repository. The advisory is integrated into the existing issuance/review and loan history screens; no new lending or top-up rules were invented.

## Policy: repayment-v1

Deployment-controlled configuration: `backend/src/config/customerRisk.js`. Change this file and restart the backend to adjust the policy. Every response/audit includes the policy version and SHA-256 policy hash, so changes are identifiable even if a version label is accidentally reused. Increment the version for intentional policy changes.

Base score = 100 minus these bounded deductions, rounded to an integer and clamped to 0–100:

| Component | Maximum points | Calculation |
| --- | ---: | --- |
| Late completion rate | 25 | Late completed installments / all installments due so far |
| Current overdue ratio | 40 | Current unpaid overdue amount / scheduled amount due so far |
| Average completed-payment lateness | 10 | Average late days among late completions, capped at 30 days |
| Consecutive missed dates | 20 | Maximum consecutive missed dates in any one loan, capped at 3 |
| Partial installment rate | 5 | Partially paid due installments / all installments due so far |

Default review guardrail: any late completion, partially paid due installment or current overdue balance caps the score at **79**. This prevents a small overdue balance from being hidden by many on-time installments. `goodRequiresNoAdverseHistory` controls this rule. Under this initial policy, historical late completions continue to require review even after the arrears are cleared; repayment still improves the weighted score. This is deliberately transparent rather than an undocumented aging/forgiveness rule.

Categories:

- **80–100: Good**, only after at least 5 installments have become due, at least 3 have completed, and the due installment history is reconstructable.
- **50–79: Review Required**.
- **0–49: High Risk**.
- **Insufficient History**: no published score when evidence is insufficient for Good and there is no adverse score requiring review/high risk. A new customer or one early receipt never becomes Good. Clear unpaid arrears can require review/high risk even without any completed payments.

## Dates, amounts and historical data

- The business calendar is **Asia/Kolkata**. Due installments include today's due dates; unpaid today is not overdue until the following business date. Future due dates never count as missed.
- Amounts use the existing paise conversion helpers. Only the actual remainder of a partial installment contributes to current arrears.
- Current installment coverage comes from `LoanSchedule.paidAmount`. Timing comes from the actual `Collection.paymentDate` and allocations, never `createdAt` or the employee's settlement date.
- The last allocation needed to fully cover an installment determines completion timing. Earlier partial receipts do not make an installment paid on time if completion was late.
- A multi-installment receipt contributes only its allocated amount to each installment; it is never counted as a separate full receipt for each installment.
- Current schedule due dates are used, so authorized due-date corrections change the next assessment. Original receipt allocation records remain untouched.
- Completed/closed loans remain in lifetime repayment analysis. Cancelled loans are excluded. Only positive `PAID`, `PARTIAL` and `EXTRA_PAYMENT` receipts supply payment evidence; missed, waived, cancelled/voided or future receipts do not.
- Legacy fully paid schedules with no allocations may use an existing actual `paidDate`. Missing dates, allocation/paid-total mismatches, or paid schedules with no reconstructable completion date are flagged as incomplete history. No dates, receipts or allocations are fabricated. Such history cannot earn Good.
- Consecutive missed dates are calculated within each loan, never across loan boundaries. They include historical due dates fully completed late and dates still overdue. Unknown paid history is not invented as a missed or timely payment.
- Religion, caste, gender, address, personal attributes, employee opinions and company settlement delays are not scoring inputs. The calculator receives only normalized financial evidence; names/codes are attached for display separately.

## APIs and access controls

All routes require the existing JWT authentication, an active existing Admin/Employee account and role authorization. Responses are `Cache-Control: no-store`.

- `GET /api/v1/customer-risk?page=1&limit=20&category=HIGH_RISK&search=prefix`
  - Optional Admin-only `employeeId` filter.
  - Limit 1–100; positive page; category allowlist; bounded literal prefix search.
  - Response `data.rows`, `data.meta` with total/page/limit/totalPages.
- `GET /api/v1/customer-risk/batch?ids=<comma-separated customer IDs>`
  - Up to 100 IDs; unauthorized customers are omitted.
  - One customer query plus three bulk financial queries, rather than one request/query set per badge.
- `GET /api/v1/customer-risk/:customerId`
  - Detailed assessment and deduplicated audit snapshot.
  - Foreign/missing customers return 404; malformed IDs return 422; no token returns 401.

Employee scope is **current customer assignment**, even where the old employee still services a historical loan. That employee's loan access does not grant access to the reassigned customer's risk history. The UI shows analysis unavailable for that assignment rather than exposing it.

## Freshness, audit and database changes

No fields, balances or dates were added to or updated on existing customers, loans, installments, receipts, KYC or settlements. No migration or repair was run.

The new `CustomerRiskAssessment` collection holds separate calculation evidence: customer/actor IDs and role, business date, version, policy hash, normalized input hash, metrics, reasons, penalties, policy and normalized installment/allocation evidence. It contains no identity documents or protected characteristics. Detailed reads insert a snapshot only when the actor, customer, business date, policy or inputs differ; repeated unchanged reads do not rewrite the stored assessment or timestamps. Listing/batch reads do not create assessment snapshots. Snapshots are retained as audit evidence and never drive financial transactions.

Assessments are calculated from current records on every request, so payment corrections/reversals, reassignment and due-date changes are reflected without a stale materialized score. The frontend reuses the existing notification/focus/visibility refresh mechanism and checks every 15 seconds while visible. Grouped list badges use one refresh request; inactive per-badge timers are disabled.

Unfiltered lists paginate customers before bulk financial reads. Exact category filters use indexed customer-ID keyset batches of 100 and bulk financial reads, retaining only the requested results page. This bounds portfolio memory and avoids N+1 queries. **Tradeoff:** an exact current category count requires scanning all matching customers; very large portfolios may need a separately designed, invalidation-safe materialized analysis index. No production-scale load test is claimed.

## Verification executed

- **Backend: 250 tests / 31 suites passed**, including 20 new risk tests (15 calculation + 5 API/integration). Existing configured coverage thresholds passed.
- **Frontend: 45 tests passed**, including 3 new risk rendering tests.
- **Frontend lint passed; production build passed**. Build output went to `tmp/customer-risk-final-build`, preserving existing `frontend/dist` changes.
- Tests cover new/one-early-payment customers, sufficient timely history, repeated arrears, repayment recovery, partial completion, actual backdated dates, IST boundaries, multi-installment payments, future/today dates, legacy gaps, cancelled/voided evidence, configurable policies, tiny arrears review guardrail, due-date changes/reversals, loan-boundary streaks, assignment changes, Admin/Employee consistency, pagination, invalid inputs and unauthorized access.
- Integration tests use a disposable `MongoMemoryReplSet`; financial snapshots prove risk reads do not change customers/loans/schedules/collections/custody/settlements. Repeated unchanged audit reads leave the audit records unchanged too.
- Browser testing used a **separate disposable database** with synthetic Admin/Employee users and synthetic repayment histories. No sample financial data was written to the configured Atlas database.
- Both portals: risk directory tested at **320, 375, 390, 430, 768, 1024, 1366 and 1920px**, without horizontal document overflow. Employee dialog tested across the same widths without internal horizontal overflow; visible directory buttons met 44px minimum height.
- Browser interactions verified login, customer-list risk actions, Employee Review Required filtering, Admin High Risk filtering, details open/close, and risk presence in Admin customer details/Loan Accounts, Employee overdue follow-ups and loan details, and Admin new-loan/active-loan review. No application console errors were observed in those checks.
- A breakpoint bug discovered during QA was fixed by mounting the native modal through a React portal outside responsive list containers. It remains visible while resizing, traps focus natively, closes with Escape/Close, and locks background scrolling.
- Screenshots visually inspected: `docs/screenshots/customer-risk/employee-risk-mobile-375.png` and `admin-risk-desktop-1366.png`.
- Main backend restarted successfully with the existing MongoDB configuration. Main frontend returned HTTP 200; the new API returned HTTP 401 without credentials, as required.

Logs: `tmp/customer-risk/backend-final-tests.txt`, `frontend-final-tests.txt`, `lint-final.txt`, `build-final.txt`.

## Changed files

Backend additions:

- `src/config/customerRisk.js`
- `src/services/customerRiskCalculator.js`
- `src/services/customerRisk.service.js`
- `src/models/CustomerRiskAssessment.js`
- `src/routes/customerRisk.routes.js`
- `tests/unit/customerRisk.test.js`
- `tests/integration/customerRisk.integration.test.js`

Backend update: `src/app.js` (mount the new protected route).

Frontend additions:

- `src/components/CustomerRisk.jsx`
- `src/components/customer-risk.css`
- `src/pages/shared/CustomerRiskDirectory.jsx`
- `tests/customerRisk.test.mjs`

Frontend updates:

- `src/App.jsx`
- `src/hooks/useCollectionRefresh.js` (optional enabled flag; existing callers keep their original behavior)
- `src/components/CustomerTable.jsx`
- `src/components/LoanDetailsView.jsx`
- `src/pages/admin/Customers.jsx`
- `src/pages/admin/CustomerPortfolio.jsx`
- `src/pages/admin/CustomerDetails.jsx`
- `src/pages/employee/CustomerList.jsx`
- `src/pages/employee/CustomerDetails.jsx`
- `src/pages/employee/AddLoan.jsx`
- `src/pages/shared/FollowUps.jsx`

Documentation: this report and the two synthetic-data screenshots. Existing uncommitted work was preserved.

## Manual acceptance checks

1. Refresh the local website. Sign in to Admin, open **Customers → Repayment Risk & Filters**, select a category and Apply filters.
2. Open **View Risk Details**. Check due/on-time/early/late counts, actual overdue remainder, reasons, policy deductions and IST calculation date against an authorized customer's original schedules and receipts.
3. Sign in as the assigned Employee. Open **My Customers**, then the same customer and risk details. Categories/metrics should agree with Admin at the same business date.
4. Check **My Loans → loan → Collection History**, **Overdue Follow-ups**, and the existing **Issue Loan** screen. Scores must be advisory; existing financial controls remain unchanged.
5. In your testing workflow, record a genuine test receipt through the existing collection process only when you choose to. Wait up to 15 seconds or use Refresh. Confirm arrears fall by the allocated amount and a backdated receipt uses its received date. Historical lateness remains visible.
6. Verify a new customer has Insufficient History, and another employee cannot retrieve that customer's risk details.
7. On an actual Android/iPhone, check the customer badges, category filter, modal scrolling, Close/Escape behavior and bottom navigation. Physical-device testing has not been performed.

No unresolved test failures. Physical-phone QA and production-scale portfolio performance testing remain manual acceptance work.
