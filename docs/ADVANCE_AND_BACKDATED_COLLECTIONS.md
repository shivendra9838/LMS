# Upcoming installments, advance receipts and backdated entries

Implemented 26 October 2026 in the existing Royal Enterprises React/Node application. Existing records and calculations are preserved. All business-day comparisons use Asia/Kolkata.

## Using the features

Both portals have **Collections & Installments** in navigation. The list offers Today, Overdue, Upcoming and All Installments, customer/loan search, mobile cards and desktop tables. Lists render 50 installments per page. Today and Upcoming include already-paid rows; Overdue includes only unpaid older balances. All Installments includes paid rows on completed/closed loans. Only open, assigned, unpaid installments expose Collect Payment.

Each row shows customer/loan, original due date, expected installment, paid amount and a derived label: Paid in Advance (Paid Early), Paid On Time, Paid Late, Partially Paid, Pending or Overdue. A partial past-due installment also shows Overdue. The stored PAID/PARTIAL enums remain compatible with existing features; no historical status migration was run.

Collection receipts and loan history show the actual received date separately from the system entry timestamp. New receipts store an allocation breakdown of amounts and installment due dates. A ₹2,100 receipt can cover three ₹700 installments without creating three revenue entries or three custody postings. Allocation covers the selected unpaid installment first, then the oldest other unpaid installments. Fully covered installments cannot be collected again. Partial receipts reduce only the remaining balance; overpayment of the whole loan is rejected.

For backdated receipts, select **Actual payment received date (India)** and provide a mandatory reason of 5–1000 characters. The API rejects invalid dates, future received dates and receipt dates before the actual loan issue date. Active Employees may record only their assigned loans; active Admins may record across assigned loans. Admin cash entries additionally require confirmation of the assigned Employee who physically received the cash. Existing receiving-account ownership/authorization rules still apply to digital receipts.

The received date is a business calendar date. Historical dates are normalized to the start of that India day, not an assertion that cash was received at midnight. System entry timestamps retain their precise current time. Receipts display the historical received date without a fabricated time of day.

Both Employee and Admin customer pages offer loan issuance. **Actual loan issue date (India)** accepts past dates and rejects future/invalid dates. Existing `loanDate` stores the actual issue date; existing immutable `createdAt` stores when the record entered the system. First installment remains due the following day. No existing loan dates were rewritten.

Reports attribute revenue to the actual receipt date, not the due date or data-entry day. Receipt exports also include system entry timestamp, reason and due dates covered. Custody postings retain both received and recorded dates. Settlement shows original-date activity separately from all-time funds held/reserved/settled; a settlement never re-credits a customer loan. New audit entries record the actor, reason, both dates and allocations. The latest loan/schedule payment date cannot move backwards when an older receipt is entered later.

No missed-day payments are generated automatically. A skipped installment stays overdue until a real receipt covers its remaining amount. Existing manual missed markers remain non-revenue records, and future installments cannot be marked missed.

## Step-by-step acceptance test

Use your own testing records in the configured database; no sample financial records were inserted there by this implementation.

1. If needed, Admin → Employees → Add Employee. Employee → Customer KYC → submit a customer; Admin → Customer Approvals → approve and assign it.
2. Open that customer's details → Issue Loan. Enter ₹20,000, 5%, 30 days and actual issue date **22 October 2026**. Verify total payable ₹21,000, daily installment ₹700, first due date **23 October**, and the current system entry timestamp. An Admin can use the same form from Admin → Customers → customer details → Issue Loan.
3. Open Collections & Installments. With a current business date of 26 October, Today shows 26 October, Overdue shows unpaid 23–25 October, Upcoming shows 27 October onward, and All Installments shows the full schedule. On a later test day, expect the date filters to advance accordingly.
4. Select the installment due 23 October. Record ₹700 with received date 23 October and an explanatory backdate reason. Repeat for 24 October. Confirm each receipt has the historical received date and the current system entry timestamp.
5. Leave 25 October unpaid: it must remain overdue without a new received-payment record. On 26 October, select the 25 October installment and record an actually received ₹1,400. The receipt should allocate ₹700 to 25 October (Paid Late) and ₹700 to 26 October (Paid On Time). Total paid is ₹2,800, with ₹18,200 remaining.
6. For advance testing, choose an unpaid future installment. Pay ₹700 today and verify it stays Paid in Advance when its due day arrives. Alternatively, select the next unpaid future installment and receive ₹2,100: three installments receive ₹700 each. Use separate actual receipts; never retry a paid installment as a new receipt.
7. For partial testing, receive ₹200 against an unpaid ₹700 installment and then its remaining ₹500. Verify Partially Paid becomes paid at the correct received date, with two genuine receipts and no excess credit.
8. Check Loan → Collection History, View payment history and the receipt's Print / Save PDF action. Due dates covered, received dates, entered dates and backdate reasons should be distinct.
9. Daily Settlement → select receipt dates to inspect historical activity. Funds held include all eligible recorded cash/digital receipts, including backdated ones. Submit to an authorized company destination; Admin → Daily Reconciliation → review evidence and approve/reject as usual. Admin cash receipt entries require the assigned-Employee custody checkbox.
10. Check Admin's Collections & Installments and reports against the same records. Try an invalid future receipt date, a date before issuance, a backdate without a reason, a foreign Employee's loan and a duplicate submission; all must be rejected or safely replayed without new money.

Employee digital receipts require an active authorized Employee UPI/bank source configured by Admin under Daily Reconciliation → Receiving accounts. Company-direct digital receipts retain their existing company-verification flow and do not become Employee-held funds.

## APIs and storage

- Added `GET /api/v1/collections/installments?scope=TODAY|OVERDUE|UPCOMING|ALL`, with optional `loanId` and Admin `employeeId`. Employee scope is enforced server-side. Existing `/collections/today` remains compatible for existing callers.
- Extended `POST /api/v1/collections` with optional `paymentDate: YYYY-MM-DD` and `backdateReason`. Omitted date retains current receipt behavior. Date, reason and Admin cash receiver are included in idempotency checks when supplied. Existing idempotency/reference uniqueness and transactions remain enforced.
- Added optional Collection fields `backdateReason` and `allocations[]` (`scheduleId`, `dueDate`, `amount`). Existing collections are not modified.
- Added optional immutable `CollectionPosition.recordedAt`; older records use their original Collection creation timestamp as a read-only display fallback.
- Loan `loanDate` and `createdAt` already existed and are reused. Issue audits now include both dates. No database migration, reset or deletion is needed.
- Legacy receipts did not store a full allocation breakdown. Their existing data is retained and clearly labeled; no retrospective breakdown or fake payment is inferred.

## Code changed

Backend: Collection/CollectionPosition models; new paymentDate/installmentStatus utilities; collection repository/service/controller/routes/validator; loan service/date validator; settlement custody timestamp; reconciliation service/exporter; report exports. New regression suite: `backend/tests/integration/datedPayments.integration.test.js`.

Frontend: shared Employee/Admin installment page, RecordPaymentModal, loan issuance and detail/history pages, receipts, customer Admin issuance link, both layouts/routes and settlement date display. Reuses current React, Tailwind, Axios, authentication, allocation, cashbook and settlement code; no new runtime dependencies.

## Executed checks and limits

- Full backend: 152 tests, 19 suites passed, including nine new dated-payment integration cases. Existing KYC, account/role permissions, collection, settlement approval/rejection/dispute, idempotency, Excel/PDF and financial compatibility suites remain included.
- Frontend: 11 existing tests passed; ESLint and production build passed. Build output is outside existing tracked frontend/dist.
- Isolated browser: Employee selected Upcoming and recorded ₹2,100; one receipt showed three ₹700 future allocations. Employee then entered a ₹700 receipt received 23 October, entered 26 October, with mandatory reason. Admin entered another backdated cash receipt using assigned-Employee confirmation. Shared Admin lists and Employee settlement totals reflected the same records. Today receipts were ₹2,100, older receipts ₹1,400 and all-time cash held ₹3,500, without double counting.
- The configured Atlas database was read only for before/after fingerprints: all 22 collections matched exactly. Browser/tests used a disposable MongoDB replica set; no synthetic customers/payments were created in the configured database.
- Desktop browser layout verified at the actual 1280px viewport. Requested widths 320, 390, 768, 1024 and 1366 were attempted, but the provider did not resize the rendered viewport. These attempts are NOT claimed as mobile/tablet passes. Phone cards, touch-size actions and responsive inputs are implemented, but actual Android/mobile browser checks remain required.
- Real Android hardware, native printing and PDF save dialogs were not executed. Existing export/PDF tests passed; receipt printing still uses the browser's native Print / Save PDF flow.

Local test logs and synthetic screenshots are under `tmp/financial-audit/dated-*`. No credentials or receiving-account details are included in this document.
