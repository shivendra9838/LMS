# Payment notifications and employee/customer navigation

Completed 28 October 2026.

## Cause and fix

The existing dispatcher sent PAYMENT_RECEIVED events as “Payment recorded” with a generic message and receipt path. The inbox renderer therefore had no employee/customer details or separate navigation actions. Employee Details linked to the customer portfolio but did not show its customers inline. Also, an already-open receipt did not reload when another notification navigated to the same receipt ID.

The existing notification infrastructure is retained. Payment cards now show actual employee name/code, customer name/code, received amount, loan number, actual installment references, payment method, received date, system entry timestamp and collection reference. Employee identity comes from the receipt's actual collectedBy reference and recordedByRole, not a guess based on current loan assignment. Admin-recorded or unavailable actors are not presented as an employee.

Wallet, UserRound, Users, CalendarDays and receipt icons accompany compact black-and-gold cards. The body opens the exact receipt. View Employee, View Customer and View Receipt are independent actions; existing read/unread controls remain available. Dates use Asia/Kolkata.

Employee Details now embeds the existing CustomerPortfolio component. It includes secure customer photos/initials, names/codes, active loans, outstanding/overdue balances, risk badges, row/name/photo links and keyboard navigation. Current customer assignment is respected. Existing server-side search, filters and pagination are reused (20 per page by default; existing 50/100 options remain).

## API and database

- Existing GET `/api/v1/notifications/inbox` now adds a safe paymentContext when an exact receipt reference can be resolved.
- New POST `/api/v1/notifications/inbox/:id/open` accepts target `receipt`, `employee` or `customer`, authorizes the recipient and destination, and returns the existing route. Management targets require Admin; Employee receipt access retains existing ownership rules.
- Notification read state changes only after the destination resolves successfully. Missing/unauthorized references fail without marking the notification read or substituting another loan payment.
- `UserNotification` has two optional additive fields: kind and paymentId. Existing fields, documents and unique recipient/role/event-key index remain intact.
- Historical generic alerts are enriched at read time through an exact stored payment ID, payment audit reference or exact receipt path. No loan-level “latest payment” fallback exists. Historical notification content is not rewritten or deleted.
- Existing employee portfolio endpoint `/api/v1/customer-portfolios/employees/:employeeId` remains Admin-only and paginated. Employee/customer/receipt routes are unchanged.
- Notification navigation refreshes existing detail reads even when the destination URL is already open. It does not write financial records.

Delivery still uses committed audit events, the durable notification dispatcher and existing authenticated SSE invalidation. Dispatcher and SSE polling each use their existing two-second cadence. Active Admin recipients receive independent persisted notifications/read states. The unique event key prevents repeat deliveries on transaction retries, dispatcher retries and restarts. A failed or aborted payment cannot publish its transaction's audit event.

A payment notification records a customer receipt event. Marking a notification read is neither Admin payment verification nor employee-to-company settlement verification. Existing receipt screens display those three states separately, including actual received date versus entry timestamp. No balances, allocations, custody, loan calculations, KYC records or settlement operations were changed.

## Existing configured data inspection

A native MongoDB client performed read-only inspection of Atlas `loan_management`. At the initial check there were six inbox records, including three generic payment alerts. All three had exact existing payment references. No customer names, contact details, credentials, full payment details or private documents were printed. No configured-database test accounts, payments or notifications were created, and no historical notifications were rewritten.

## Verification results

- Backend: **284 tests / 34 suites passed**, with normal coverage checks.
- Frontend: **69 tests passed**.
- Frontend lint: **passed**.
- Production build: **passed**, in `tmp/payment-notices/build-final` to preserve pre-existing dist changes.
- New backend cases cover committed payments to active Admins, two same-named employee/customer pairs with distinct IDs, exact multi-installment context, API/dispatcher idempotency, read-after-authorized-open, foreign access rejection, legacy enrichment without writes, missing references, actual transaction rollback, and server pagination of 21 assigned customers.
- Existing notification SSE, revoked-session, delayed-commit and rolled-back-event tests also passed.

### Full browser workflow actually executed

Used the real frontend and backend against a disposable in-memory replica set, with synthetic accounts/customers/loans. The normal configured database was never used for test writes.

1. Signed in to both Admin and Employee portals.
2. Opened Admin's live inbox with three unread notifications after opening an earlier alert.
3. Used Employee → Collections → Collect Payment to record Day 2 through the existing form.
4. Without refreshing Admin, observed the new detailed COL000002 alert and unread count increasing from 3 to 4.
5. Opened its body and confirmed the exact Day 2 receipt ID, COL000002, installment 2 and ₹700. The earlier COL000001/Day 1 receipt was not substituted.
6. Verified View Employee and View Customer opened the actual IDs, and Employee Details displayed the assigned customer.
7. Used Enter on the desktop customer row and clicked a non-action field on the mobile customer card; both opened the existing correct Customer Details page.
8. Opened Customer Details → Payments & Collections → the same exact receipt.
9. Confirmed receipt states remained customer payment recorded, not verified by Admin, and not settled.
10. Refreshed, logged out/in, and confirmed the same notification and read state persisted. Mark unread updated the count and unread highlight.
11. Reopened a notification for the already-displayed receipt and confirmed its generated/read data refreshed, rather than retaining stale data.

Notification popup and assigned-customer page had no document horizontal overflow at **320, 375, 390, 430, 768, 1024, 1366 and 1920px**. Clean browser checks reported no console errors. Screenshots in `docs/screenshots/payment-notifications/` contain only synthetic data. Physical Android/iPhone checks remain manual; browser viewport testing is not a real-device test.

The normal local servers were reloaded with existing configuration. Frontend 5173 returned 200; unauthenticated inbox access on backend 5000 returned 401. The normal frontend was checked to ensure it does not use the isolated test API. Temporary test servers were stopped after verification.

## Files changed

Backend:

- `src/models/UserNotification.js`
- `src/services/inbox.service.js`
- `src/services/paymentNotification.service.js` (new batched read-only enrichment)
- `src/routes/notification.routes.js`
- `tests/integration/paymentNotifications.integration.test.js` (new)

Frontend:

- `src/components/NotificationBell.jsx`
- `src/components/PaymentNotification.jsx` (new card, not a new details page)
- `src/components/notification-bell.css`
- `src/pages/admin/EmployeeDetails.jsx`
- `src/pages/admin/CustomerPortfolio.jsx`
- `src/components/portfolios/PortfolioUi.jsx`
- `src/pages/employee/Receipt.jsx` (same-destination notification refresh only)
- `tests/paymentNotification.test.mjs` (new)

This report and synthetic screenshots were added. No dependencies, credentials, roles, account settings or logo assets were changed. Existing uncommitted work was preserved.

## Manual paths

1. For a legitimate recorded customer payment, open Admin's notification bell. Expect the detailed alert within the existing delivery cadence, without reloading.
2. Use View Employee → Assigned customers → customer name/photo/row.
3. Customer Details → Loan Accounts / Installment Schedule / Payments & Collections → Existing Receipt / Print.
4. View Receipt on the original alert must open that exact collection, not another receipt on the same loan.
5. Check read/unread state across login sessions and test the same controls on a physical phone.

No remaining application errors were identified. Actual configured-database payment entry and physical-device testing were intentionally not performed.
