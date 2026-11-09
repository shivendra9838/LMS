# Real customer repayment scores — no demo

Current implementation, 28 October 2026. This supersedes the earlier demo-enabled speedometer report.

## What changed

All demo controls, demo sequence values, role/development demo switches and demo timers were removed from application source. Both portals still use the same CustomerRisk modal, RepaymentSpeedometer component, private risk APIs and backend calculator. The real SVG needle/pivot is retained: it animates from zero on opening and from the last drawn position when the published backend score changes, over 1,500ms. Reduced motion snaps to the actual value. Unrated customers have a hidden needle and no numeric score.

`repayment-v2` introduces an explicit score-publication policy. It changes no loan calculations or repayment records. The existing decision-support categories remain separate from the five visual bands.

## Publication and confidence policy

| State | Required evidence | Display |
| --- | --- | --- |
| Provisional | At least 3 installments whose due dates have arrived, at least 3 completed installments fully covered by valid dated receipt allocations, and no incomplete histories | Actual formula score; Provisional — Limited History; LOW confidence |
| Established | Existing rule: at least 5 due installments, 3 completed installments with known payment dates, and no incomplete histories | Actual formula score; Established History; MODERATE confidence |
| Unrated | Neither gate is satisfied, or history is incomplete | Not Rated Yet; no number; NONE confidence; exact evidence shortfall |

Established confidence becomes HIGH at 15 due / 10 receipt-verified completed installments. All gates are configurable in `backend/src/config/customerRisk.js`. Confidence is an ordinal evidence-strength indicator, not a probability or calibrated credit model.

Here, verified means full coverage by valid dated receipt allocations; it is independent of Admin payment review and employee-to-company settlement verification.

One payment covering three distinct due installments can supply three verified completions; independent receipt days are not required. Future installments, including paid future installments, do not count as observed due history until their due dates arrive. One early installment is insufficient. The existing legacy rule accepts actual stored paidDate records when no receipt references exist; legacy and receipt-verified completion counts are reported separately. Missing dates are never invented.

Unrated customers can still have an adverse decision-support category from real arrears. This warns the reviewer without publishing a poorly evidenced numeric rating. A provisional score of 90–100 can have the visual label Excellent while the authoritative category remains Insufficient History; it never upgrades loan eligibility or approval.

### Formula retained

Start at 100 and subtract the existing normalized deductions: late-rate up to 25, overdue-amount ratio up to 40, lateness up to 10, consecutive missed installments up to 20, and partial-payment rate up to 5. The original caps and denominators remain unchanged. Any late completion, partial due installment or current overdue balance caps the score below Good when the existing guardrail is enabled.

Authoritative thresholds remain High Risk below 50, Review Required 50–79, Good from 80 only with sufficient established evidence; otherwise Insufficient History. Visual bands remain 0–29 Very Bad, 30–49 Bad, 50–79 Average / Review Required, 80–89 Good, 90–100 Excellent. All prior non-cancelled loans, including completed/closed loans, remain in the evidence pool.

## Corrections, invalidations and automatic updates

The service now reads all receipt states before deciding which provide positive evidence. A voided/invalidated or future receipt reference prevents fallback to a stale legacy paidDate. Inconsistent paid coverage is flagged and blocks numeric publication; the scorer never repairs balances or creates replacement payments.

Every risk read recalculates from current loans, installment schedules and valid allocations. There is no cached score used for decisions. Existing Asia/Kolkata business-day helpers remain authoritative. Polling every 15 seconds while visible, notification events, focus and visibility refresh cover new arrears after IST midnight even without a payment. A new successful-write event also immediately refreshes financial views after payment/loan/schedule writes. Failed writes, risk reads and unrelated writes do not trigger refresh loops.

No payment reversal API or financial correction operation was added. Existing valid corrections/reversals are reflected by subsequent reads of their resulting records. Tests model invalidated legacy records only in isolated memory databases.

## Shivendra: read-only configured-database check

Checked MongoDB Atlas `loan_management` using a read-only native client, without calling the audit-writing risk endpoint. The client did not modify records or create indexes. No credentials, document data or private contact information were printed.

Snapshot as of business date **28 October 2026, IST**: one matching customer, one loan with 30 schedules, one receipt, two due installments, one verified early completion, no incomplete history. Result: **UNRATED / Not Rated Yet**. The provisional shortfall is **one more due installment and two more verified completions**. These are simultaneous evidence requirements; time alone does not turn an unpaid installment into a completed one. The live result may change when legitimate payments or business dates change.

## Official Credit Bureau Score

No authorized bureau integration or bureau configuration was found. The UI therefore shows **Not Connected**, separate from the internal score. No score was generated, estimated, scraped or requested from a bureau.

Official onboarding research: TransUnion CIBIL describes eligibility and membership documents for credit institutions/specified users on its [membership page](https://www.transunioncibil.com/become-a-member). Its [API getting-started guide](https://apimarketplace.transunioncibil.com/getting-started) requires organization onboarding through the designated KAM and separate UAT/production subscriptions. Its [Consumer Connect service](https://apimarketplace.transunioncibil.com/products/credit-data/dtc-consumer-connect-services) describes a consent-based model. Before a real connection, the business must complete the applicable authorization, permitted-purpose and customer-consent process, secure credentials and approved API connectivity. No onboarding messages or customer information were sent.

## Files changed

Backend:

- `src/config/customerRisk.js`: versioned publication/confidence gates; existing weights and category thresholds retained.
- `src/services/customerRiskCalculator.js`: provisional/established/unrated metadata, confidence, shortfalls, verified/legacy counts and invalidation evidence handling.
- `src/services/customerRisk.service.js`: read invalidated receipt references as well as valid payments.
- `tests/unit/customerRisk.test.js` and `tests/integration/customerRisk.integration.test.js`: policy, dates, receipts, permissions, consistency and immutability regressions.

Frontend:

- `src/components/RepaymentSpeedometer.jsx`: no demo; real provisional score support and confidence/shortfall display.
- `src/components/CustomerRisk.jsx`: provisional badges, policy explanation, separate unconnected bureau section.
- `src/components/customer-risk.css`: remove demo styles; confidence and bureau presentation.
- `src/utils/repaymentNeedle.js`: remove demo-only code; keep real-score cancellable animation.
- `src/services/api.js` and `src/hooks/useCollectionRefresh.js`: immediate role-scoped refresh after successful financial writes.
- `tests/repaymentNeedle.test.mjs`, `tests/repaymentSpeedometer.test.mjs`, `tests/customerRisk.test.mjs`, `tests/financialRefresh.test.mjs`.

No new schema, financial migration, database reset or dependency installation was required. Existing policy-v1 audit snapshots are retained; the new policy hash/version produces separate analysis snapshots through the existing audit mechanism. Existing uncommitted work was preserved.

## Verification

- Backend: **277 tests / 33 suites passed**, including real isolated collection API → risk recalculation, multi-installment advance coverage, partial payments, late/overdue, IST midnight, prior loans, receipt invalidation, foreign employee access, Admin/Employee consistency and financial-record immutability.
- Frontend: **67 tests passed**, including no demo controls, provisional rendering, exact bands and needle geometry, interrupted animation cleanup, successful-write refresh and absence of read/failure refresh loops.
- Lint and production build: **passed**. Build output is in `tmp/risk-real/build-final`, preserving existing dist artifacts.
- Browser: actual shared component using HTTP responses from the existing calculator and isolated synthetic input arrays, with no MongoDB connection. Checked Admin and Employee URL contexts, no demo controls, provisional/established/unrated states, live score change and invalidation, and no horizontal overflow at 320, 375, 390, 430, 768, 1024, 1366 and 1920px. Clean browser sessions had no console errors. Reduced motion uses an isolated media-query stub; this does not claim physical-phone or OS setting verification.
- Configured database: only the read-only evidence check above. No sample customers or payments were inserted there.
- Local frontend 5173 and backend 5000 were checked; frontend returned 200 and unauthenticated risk access returned 401. Backend was restarted with existing configuration to load policy v2.

## Manual check

1. Admin → Customers or Employee → My Customers → View Risk Details. Confirm there is no Test Speedometer control in either portal, including development mode.
2. For Shivendra, expect Not Rated Yet until the evidence gates are met; compare the observed counts and exact shortfall with the installment history.
3. After a legitimate payment, allow automatic refresh. Verify partial balances and actual received dates, not entry timestamps. Do not add fake payments to force a score.
4. For eligible customers, check the exact score, provisional/established status, confidence, reasons and technical policy version. Loan review/detail locations use the same component.
5. On an actual phone, check portrait/landscape, scroll, close/reopen, and reduced-motion behavior. Physical-device checks remain manual.


