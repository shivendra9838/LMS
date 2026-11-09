# Receipt allocation clarity and automatic extra payments

## Actual read-only reconciliation, 28 October 2026

COL000005 / LN000001 / CUS000001 / EMP0001 already reconciles. Its original ₹800 CASH receipt allocates ₹700 to Day 2 and ₹100 to Day 3. Day 2 is fully covered on its due date; Day 3 has ₹600 remaining and is partially paid in advance. Receipt allocated total ₹800; unallocated ₹0. Together with the earlier ₹700 receipt, loan paid is ₹1,500 and outstanding is ₹19,500 against ₹21,000 total payable. One cashbook entry and one ₹800 employee custody position exist, with zero reserved/settled funds and zero settlement dependencies for this receipt.

The discrepancy was presentation: installment-specific paid ₹700 and full receipt ₹800 are different measures, and the shared history/list did not explain the ₹100 allocation to the next day. No repair was needed or applied, no financial backup/write was proposed, and no new receipt was created in the configured database. A final read-only JSON comparison found the financial values unchanged (semantic comparison; console encoding differs).

## Changes

- backend/src/utils/collectionAllocation.js: one pure integer-paise oldest-unpaid planner, rejecting unapplied excess or inconsistent installment balances.
- backend/src/services/collectionAllocationPreview.service.js: reuse planner for quote, totals and next installment remaining.
- backend/src/services/collection.service.js: reuse planner inside existing transaction; preserve idempotency, receipt dates, loan posting, cashbook, custody, audit and notifications; add read-only receipt allocation totals.
- backend/src/services/customerPaymentReview.service.js: batch-load actual allocation references and collector names; add full-receipt/local-allocation/carry-forward context to both list and history endpoints.
- backend/src/utils/installmentStatus.js: display Partially Paid in Advance for future partially covered installments; stored financial status remains PARTIAL.
- frontend/src/pages/employee/TodayCollections.jsx (also reused by Admin): distinguish scheduled, allocated/paid and remaining; expandable source-receipt details.
- frontend/src/components/collections/PaymentReviewModal.jsx: full receipt versus local amount, other allocations, collector, totals; preserve separate Admin verification.
- frontend/src/components/collections/RecordPaymentModal.jsx: customer/day/scheduled/already adjusted/remaining fields, preview totals/next remaining and required confirmation tied to payment inputs.
- frontend/src/components/receipts/PaymentReceipt.jsx: explicit total allocated/unallocated on the shared screen and print receipt. Legacy receipts without allocation evidence say Not recorded rather than inventing totals.
- backend/tests/unit/collectionAllocation.test.js: ₹600/₹750/₹1,500 and paise/invalid balance cases.
- backend/tests/integration/sequentialCollections.integration.test.js: ₹800 history/receipt context in both roles, partial advance, ₹750 preview/commit, duplicate retry, one cashbook/custody posting, review without financial posting.
- backend/tests/integration/customerPaymentReview.integration.test.js and datedPayments.integration.test.js: assert the requested future-partial label.
- frontend/tests/installmentHistory.test.mjs: full ₹800/local ₹700/carried ₹100 presentation in both portals.

## Executed verification

- npm test -- --runInBand: 35 suites, 289 tests passed, zero failures (backend).
- Targeted rerun of customer payment review and dated payments: 21 passed.
- node --test tests/*.test.mjs: 70 passed, zero failures (frontend).
- npm run lint: passed.
- npm run build -- --outDir ../tmp/extra-payment/build-final: passed. Output kept separate from existing tracked dist.
- Isolated MongoMemory replica-set browser fixture, never configured Atlas: Employee login; all installments; Day 2 history ₹800/₹700/₹100; payment form ₹700 scheduled/₹100 adjusted/₹600 remaining; ₹750 preview, disabled submit before confirmation, confirmation and successful save; receipt ₹600+₹150, ₹550 next balance, ₹18,750 outstanding after test-only payment.
- Admin login; matching Day 2 history; full ₹800 receipt with allocations and totals; Admin verification marked Verified without settling funds. No browser console errors observed.
- Admin/Employee shared receipt and history tested at 320, 375, 390, 430, 768, 1024, 1366 and 1920 CSS px. Document and modal scroll widths did not exceed available widths. Browser emulation, not physical-phone testing.
- Normal website backend restarted, connected to MongoDB on port 5000; frontend remains on port 5173. Disposable servers stopped after checks.

## Limits

The Print / Save PDF action was exercised, but the in-app browser blocked subsequent inspection at its native print boundary. A saved A4 PDF and physical/mobile printing are NOT VERIFIED. Existing receipt print styles remain shared and frontend tests pass. Verify in Chrome with A4, default margins and no browser headers/footers.

No customer-payment reversal endpoint exists. Existing regression coverage simulates a reopened balance only inside an isolated database and verifies sequence/quote revalidation. An actual authorized payment reversal workflow is NOT VERIFIED and was not added as an unrequested financial posting operation.

## Browser acceptance steps

1. Refresh the normal website; open Admin → Collections & Installments → All Installments → LN000001.
2. Day 2: scheduled ₹700, allocated ₹700, remaining ₹0, Paid On Time. Open receipt breakdown/history: COL000005 total ₹800 and ₹100 carried to Day 3.
3. Day 3: allocated ₹100, remaining ₹600, Partially Paid in Advance while still future-due. History must link to the same COL000005.
4. Open full receipt: received/allocated ₹800, unallocated ₹0, Day 2 ₹700 and Day 3 ₹100. Current outstanding remains ₹19,500 until another real payment is recorded.
5. Employee sees the same data. Enter ₹750 only if actually received: preview must show Day 3 ₹600, Day 4 ₹150, next remaining ₹550. Confirm before recording. Do not enter a synthetic payment into the configured database.
6. Print / Save PDF from Chrome and verify A4 pagination and both allocation rows. Review and settlement statuses must stay separate.

Evidence and command logs: tmp/extra-payment/. Screenshots use disposable customers only.
