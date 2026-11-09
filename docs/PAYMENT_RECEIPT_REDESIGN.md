# Payment receipt UI and A4 printing

Completed 27 October 2026.

## Result

Admin and Employee receipt routes use one shared white-paper receipt component. It has the original small proportional Royal Enterprises logo, company name/tagline, Payment Receipt heading, customer/loan references, actual receipt date, original entry timestamp, amount received in INR, method, transaction reference and actual actor information. No company address, GST number, signature or verification has been invented.

The previous light box inherited light text from the portal's dark theme. The new receipt uses scoped colours and its own light colour scheme, while the surrounding portal keeps its existing theme. The old absolute-position/visibility print hack was removed. A4 print styles hide navigation and controls, reset the dark root canvas, use 12 mm margins, wait for fonts/logo decoding and preserve normal document pagination.

## Financial labels and data accuracy

- The original payment amount, payment date, recorded timestamp and allocation amounts are retained.
- Each covered installment shows its number, due date, scheduled amount, amount applied from this receipt, total paid to date and current remaining balance.
- Current loan outstanding comes from the stored loan balance. Current balances are labelled with the response generation timestamp. Historical receipt-time balances were not stored, so the UI does not fabricate or reconstruct them.
- Customer payment recorded, Admin receipt review and employee settlement have separate labelled sections. Admin verification does not imply company settlement.
- Company-direct digital receipts can show settlement Not applicable while company funds confirmation is Pending. NOT_REQUIRED is never presented as a positive company verification.
- MISSED/WAIVED/zero-value entries cannot display a successful payment or verified receipt badge. Missing values remain Not recorded, rather than invented zero values.
- Received/recorded by uses the actual declared collection actor. Admin entries identify the Admin separately from the assigned employee. Legacy actor provenance is not guessed.
- Legacy receipts without allocation arrays keep a recorded installment reference when available and explicitly state that allocation details were not stored.
- The footer says Computer-generated receipt, includes the generation time in Asia/Kolkata and company branding, and does not reproduce a signature.

## Changed files

Created:

- `frontend/src/components/receipts/PaymentReceipt.jsx`: shared paper rendering and status labels.
- `frontend/src/components/receipts/payment-receipt.css`: theme-independent screen styling, mobile allocation cards and A4 print rules.
- `frontend/tests/paymentReceipt.test.mjs`: five rendering/status/provenance regressions.

Updated:

- `frontend/src/pages/employee/Receipt.jsx`: used by both portals; retains navigation/history/printing, adds cancellable loading, retry handling and image/font readiness before printing.
- `backend/src/services/collection.service.js`: read-only receipt response enrichment, actual actor lookup, installment details and current loan outstanding. Existing response fields and ownership checks are retained; inactive/invalid actors and invalid identifiers are rejected.
- `backend/tests/integration/customerPaymentReview.integration.test.js`: three receipt regressions covering both roles, multiple allocations, later-payment balances, original record preservation, ownership and actual Admin actor identity.

Report/screenshots: this document and `docs/screenshots/payment-receipt/`.

The existing `GET /api/v1/collections/receipt/:collectionId` endpoint remains unchanged. New response fields are additive: enriched allocations, `primaryInstallment`, `currentLoanOutstanding`, `generatedAt`, and `receivedBy`. No schema or database migration was introduced. No payment posting, interest, loan, approval, KYC, custody or settlement calculation was changed.

## Executed checks

| Check | Result |
| --- | --- |
| All backend tests and configured coverage checks | PASS: 230 tests, 29 suites |
| All frontend tests | PASS: 42 tests |
| Frontend ESLint | PASS |
| Production build | PASS: `tmp/payment-receipt-final-build` |
| Same receipt payload for Admin/owning Employee | PASS; amount/allocation/current-balance checks match |
| Unrelated Employee / public access / invalid ID | PASS: rejected |
| Original partial receipt after later payments | PASS: original amount/allocations unchanged; only explicitly current balance details reflect subsequent payments |
| Dark Employee and light Admin receipt | PASS: white paper, dark text, readable amount and status boxes |
| Measured visible text contrast, light receipt | Minimum approximately 6.37:1 |
| Responsive browser checks, both portals | PASS at 320, 375, 390, 430, 768, 1024, 1366, 1920px; no document/paper horizontal overflow; tested toolbar controls at least 44px high |
| Single-payment A4 export | PASS: one page |
| Three-installment / partial-balance A4 export | PASS: one page |
| Company-direct UPI A4 export | PASS: one page; pending funds and no employee settlement are distinct |
| Thirty-installment A4 export | PASS: three pages, repeated table headings; all installments 1-30 retained |
| PDF visual inspection | All six final exported pages inspected; no cropped rows/text, dark margins or missing logo |
| PDF structural checks | A4 dimensions within browser rounding; complete footer; INR glyph present; navigation/toolbar text absent; white corner pixels |

Print exports used the actual shared React receipt markup and print CSS with database-generated, authorized isolated fixtures, rendered through the installed Edge print engine in separate temporary profiles. They are not an alternate hand-drawn PDF template. One reviewed synthetic sample is in `output/pdf/royal-enterprises-payment-receipt-synthetic.pdf`.

The first print review found the portal's dark root background appearing in paper margins. Resetting the root canvas in print CSS fixed it. Spacing was refined so a typical three-installment receipt fits on one A4 page. An initial restricted headless export could not initialize its GPU process; a hidden, isolated export process completed successfully. During source editing, React Fast Refresh emitted a transient changed-dependency-array warning; fresh page loads had no recorded application console errors.

Browser Print buttons were invoked for both roles. Native print-dialog completion is not exposed reliably by the in-app browser; the Admin invocation paused browser automation while the print dialog was active, and the isolated test tab was closed. A4 output was verified separately using the same markup/styles and actual browser print engine. Physical printer output and real Android/iPhone print dialogs were NOT VERIFIED.

## Configured database preservation

No sample customers, loans, payments or receiving accounts were created in the configured database. Test writes were restricted to disposable local MongoDB replica sets.

After restarting the local backend, read-only HTTP checks against the configured `loan_management` database confirmed the existing 700 INR receipt in both authorized roles. Its original payment date (26 October 2026), entry timestamp and Day 1 allocation were preserved. Installment remaining was zero and current loan outstanding matched the stored loan balance. A before/after digest of Collections, Loans, LoanSchedules, CollectionPositions, CashBooks and EmployeeSettlements remained identical during verification. Database auto-creation/indexing was disabled in the verification client. No credentials or customer names were printed by that check.

The local backend is running with the changes on port 5000; the main frontend remains on port 5173. Existing uncommitted work and configuration were preserved.

## Manual acceptance

1. Refresh the existing receipt page in either portal. Alternatively, Collections & Installments → All Installments → paid installment History → View full receipt and allocation breakdown.
2. Check the original amount/date, actual receiver/recording actor, installment allocations and balances. Current balances can differ from a historical receipt's original amount; the generation time explains the balance date.
3. Confirm Admin review and employee settlement match their separate underlying records.
4. Choose Print / Save PDF, A4 portrait and 100% scale. Disable the browser's optional headers/footers for the cleanest output. The application's print CSS supplies 12 mm margins and hides navigation/buttons.
5. Repeat on an actual Android/iPhone and a physical printer if required. Screen widths were emulated; no real-device test is claimed.

No unresolved application test failures remain. Native phone/printer verification is the remaining manual check.
