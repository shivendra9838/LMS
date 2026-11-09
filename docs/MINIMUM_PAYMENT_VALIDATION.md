# Minimum payment validation — 4 November 2026

Implemented for the existing shared Record Payment modal, including Employee Collections → Collect Outstanding Dues. No migration or configured-database financial writes were performed. Automated/browser test writes used MongoMemoryReplSet databases only.

## Behavior

- The existing authorized allocation-preview endpoint now accepts `paymentDate` (India business date) and optional `amount`. Omitting amount returns a suitable prefill: the full minimum when debt is due, or the first unpaid installment balance when only advances are available.
- The preview includes `minimum` (`effectiveDay`, `previousOverdue`, `todayUnpaid`, `minimumPayment`), `loanOutstanding`, and `meetsMinimum`. Previewing below the minimum is informational; it never authorizes a save.
- The minimum uses integer paise and actual saved schedule allocations. Previous overdue excludes the effective date; today's due includes only that date. Fully allocated installments contribute zero. Future installments impose no minimum.
- For backdated receipts, existing allocations are not reconstructed or re-credited. Already allocated funds are subtracted once, even if another receipt was entered later.
- POST `/collections` recomputes the minimum inside the existing transaction. An under-minimum payment returns HTTP 422 with the exact minimum error. Invalid formats can also be rejected by the pre-existing HTTP 400 request validator. Existing upper-balance validation, sequence checks, backdate reasons, roles, idempotency, receipts and custody remain in effect.
- The modal fetches the date-specific summary, prefills the amount, blocks invalid confirmation/submission, shows an accessible inline error and red border, and refreshes quotes after submission errors. It fails closed when the minimum cannot be loaded.

## Application files

- `backend/src/utils/minimumPayment.js` — shared minimum calculation and server error.
- `backend/src/services/collection.service.js` — transactional submission validation.
- `backend/src/services/collectionAllocationPreview.service.js` — effective-date summary, default amount and stale-preview protection.
- `backend/src/routes/collection.routes.js` — pass selected receipt date to preview.
- `frontend/src/utils/minimumPayment.js` — amount/minimum/upper-limit validation.
- `frontend/src/components/collections/RecordPaymentModal.jsx` — summary, prefill, date updates, errors and disabled submit.
- `frontend/src/components/collections/record-payment-modal.css` — compact gold summary, readable validation and scoped red border overriding the existing portal theme.

## Tests

New files:
- `backend/tests/unit/minimumPayment.test.js`
- `backend/tests/integration/minimumPayment.integration.test.js`
- `frontend/tests/minimumPayment.test.mjs`

Existing isolated fixture adaptations (no tests removed):
- `backend/tests/integration/settlement.integration.test.js`
- `backend/tests/integration/financialWorkflow.integration.test.js`
- `backend/tests/integration/sequentialCollections.integration.test.js`
- `backend/tests/integration/customerPaymentReview.integration.test.js`
- `backend/tests/integration/customerPortfolios.integration.test.js`
- `backend/tests/integration/kyc.integration.test.js`
- `backend/tests/integration/datedPayments.integration.test.js`
- `backend/tests/integration/followUps.integration.test.js`
- `backend/tests/integration/dashboardFinance.integration.test.js`
- `backend/tests/integration/collectionPerformance.integration.test.js`
- `backend/tests/integration/paymentNotifications.integration.test.js`
- `backend/tests/integration/customerPhoto.integration.test.js`
- `backend/tests/integration/employeeCustomerPortfolio.integration.test.js`

The earlier test fixtures intentionally made small new payments on loans with many unpaid due installments. Those requests are now invalid by design. Valid new partial-payment scenarios use explicitly dated advances, while dashboard tests seed explicitly labeled historical partial receipts directly in the disposable database to keep coverage of preserved historical states. Settlement fixtures now have actual next-day schedules instead of all 100 installments due on issuance. Dedicated new tests assert that due-date underpayments are rejected without financial writes.

Results:
- Full backend `npm test -- --runInBand`: **43 suites, 375 tests passed**, existing coverage thresholds passed.
- After the final stale-preview guard, minimum/sequence targeted rerun: **3 suites, 16 tests passed**.
- Frontend `node --test tests/*.test.mjs`: **186 passed**, zero failures.
- Frontend `npm run lint`: passed.
- Frontend `npm run build`: passed.

Covered: today's due, overdue plus today's due, partially allocated balances, prior advances, paise rounding, India-midnight boundary, below/equal/above minimum, zero/negative/invalid/excessive amounts, date/reason restrictions, ownership, forged minimum bypass, stale balances, idempotency, unchanged financial state on rejected submissions, and existing financial regression suites.

## Browser verification

Disposable full LMS at local ports 5018/5188; no configured-database customer/payment test writes.

- Logged in through the actual Employee login form.
- Opened Collections → Collect Outstanding Dues.
- Exact database-generated example: previous overdue **₹908.35**, today's due **₹181.67**, prefill/minimum **₹1,090.02**.
- Entered **₹1,090.01**: exact error text, red computed border, submit disabled.
- Entered exact minimum and **₹1,200**: valid previews and confirmation allowed.
- Selected the previous date: summary and prefill recalculated to **₹908.35**.
- Selected issue date: minimum **₹0**, advance behavior retained; no fabricated debt.
- Submitted exactly **₹1,090.02** on the current India date. Actual receipt opened; six allocations of **₹181.67**, loan balance **₹9,809.98**, overdue/today unpaid **₹0**. Admin review unverified and employee settlement unsettled, as expected.
- Viewports: **320×800, 375×900, 390×900, 768×900, 1366×900**. Modal/body had no horizontal overflow, footer remained within viewport, and height stayed at 90vh. Browser emulation only; no physical-phone test.
- Browser error log was empty after receipt generation.
- Screenshots: `docs/screenshots/minimum-payment/mobile-320.jpg`, `desktop-1366.jpg`.
- Normal backend restarted with tested code; health endpoint OK and frontend port 5173 HTTP 200.

## Manual check

Open Employee → Collections → Collect Outstanding Dues. Confirm the summary against your actual unpaid schedule balances. Enter one paise below the shown minimum, then the exact minimum. Changing the actual received date must recalculate the summary. Supply a valid reason for a backdated receipt. Only submit when real money was received; no test records were added to your configured database.
