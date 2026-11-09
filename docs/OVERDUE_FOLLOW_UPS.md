# Overdue follow-ups and reminders

Implemented 27 October 2026 in the existing Royal Enterprises LMS.

## Navigation and workflow
Admin and Employee: sidebar > Overdue Follow-ups. Dashboard has an Overdue Follow-ups & Reminders link. Loan Details has Follow-up history & reminders, including after the overdue amount is cleared.

1. Open the overdue list. Each loan card shows customer name and phone, loan number, assigned employee, overdue amount, age of the oldest unpaid due date and number of unpaid overdue installments.
2. Call Customer opens the device dialer. WhatsApp Reminder opens a user-controlled draft; no message is automatically sent, and saving notes does not invoke any messaging service. The generic draft contains no loan number, amount, bank details or KYC data.
3. Open Follow up & history. Select Customer Promised to Pay, No Response, Will Pay Later or Payment Dispute. Save actual contact date, remarks, next reminder and promised date where applicable.
4. Notes are append-only. Correct an earlier entry by adding another entry. The original note, actor, contact date and system entry timestamp remain available in paginated history.
5. Admin can filter by employee, customer/loan, minimum/maximum overdue days, minimum/maximum amount and follow-up status. Summary and employee portfolio coverage use the applied filters. Coverage means loans with follow-up records; it does not prove a phone call was completed or credit payments to an employee.

## Financial behavior and permissions
The feature reuses overdue.service overdueAggregation and scheduleSummary. It reads existing positive unpaid schedule balances before the current Asia/Kolkata business day on eligible open loans. Matured unpaid loans remain visible. Partially paid dates count as unpaid overdue installments until covered. Advance and backdated receipts continue through the existing payment and allocation logic.
No payment, loan, schedule, cashbook, custody or settlement record is written by a follow-up. Payment Dispute is a contact outcome and does not modify financial dispute or settlement states.
All APIs require JWT authentication and active-account checks. Employees can list and add notes only for loans currently assigned to them and can view history only within the same ownership boundary. Admin can view all and add attributed notes. Date/amount filters, statuses, remarks and date order are validated server-side. Future contact dates are rejected. Promise dates are mandatory for promised/later outcomes. A reminder cannot precede the contact date.
A transaction saves each new OverdueFollowUp with one FOLLOW_UP audit entry. Unique author/request key and request hashes make retries idempotent and reject changed payloads under the same key. No update/delete API is provided.

## Reminder behavior
Existing persisted notifications and secure SSE are reused. New notes notify active Admins and the current assigned Employee after commit. Existing overdue installment summaries continue for Employees.
While the backend is running, date-based reminder checks run about once per minute using Asia/Kolkata. The earlier of the promised payment date and next reminder date determines when a note becomes actionable. Latest notes are ordered by actual contact date and entry timestamp; a backfilled older contact does not override a newer actual contact.
- Employee gets scheduled or missed follow-up/promise reminders.
- Admin gets a daily unresolved-overdue summary and missed follow-up/promise alerts.
- Stable recipient/event keys prevent duplicate reminders on repeated polling or dispatcher retries. Outstanding cases may receive a new daily reminder.
- Once arrears are cleared by valid payments, the loan leaves the current overdue/reminder query. Its note history and previously delivered notification history remain available.
The page updates from notification invalidations and a 15-second refresh fallback. In-progress remarks remain mounted during background refresh.

## API and schema additions
- GET /api/v1/follow-ups — scoped, filtered and paginated current cases, summary and employee coverage.
- GET /api/v1/follow-ups/:loanId/history — authorized paginated append-only history, including resolved cases.
- POST /api/v1/follow-ups/:loanId — validated, idempotent contact note plus audit entry.
- New OverdueFollowUp collection stores the loan/customer/assignment, actual actor role and reference, outcome, contact date, remarks, optional promise, next reminder, immutable entry timestamps and request deduplication metadata.
Existing financial documents are not migrated or repaired.

## Files created or modified
- backend/src/models/OverdueFollowUp.js (new)
- backend/src/services/followUp.service.js (new)
- backend/src/routes/followUp.routes.js (new)
- backend/src/app.js
- backend/src/services/inbox.service.js
- backend/tests/integration/followUps.integration.test.js (new)
- backend/tests/unit/followUpReminder.test.js (new)
- frontend/src/pages/shared/FollowUps.jsx (new)
- frontend/src/pages/shared/follow-ups.css (new)
- frontend/src/utils/followUpPresentation.js (new)
- frontend/src/App.jsx
- frontend/src/layouts/PortalShell.jsx
- frontend/src/components/LoanDetailsView.jsx
- frontend/src/pages/admin/Dashboard.jsx
- frontend/src/pages/employee/Dashboard.jsx
- frontend/vite.config.js (explicit preview cache override; main cache default unchanged)
- frontend/tests/followUps.test.mjs (new)

## Executed verification
- All backend tests: 29 suites, 220 tests passed, existing coverage thresholds passed.
- Frontend: all 28 tests passed; lint and production build passed. Output under tmp/follow-up-final-build preserves prior dist edits.
- New tests cover matured arrears, partial/advance/backdated allocations, note history, financial snapshots, date and amount validation, employee ownership, concurrent retries, one audit per note, Admin actor attribution, scoped reminder deduplication, committed live notifications and resolution retaining history.
- Frontend tests check explicit safe phone/draft URLs, required follow-up fields and absence of financial submission fields.
- Browser QA used a disposable local MongoDB replica set and synthetic accounts, customer, loan and receipts only. Employee saved a promise; Admin saw its exact text, author and dates, and filtered by promise status. Notifications appeared through the existing live bell. Background refresh retained a draft.
- Admin and Employee list/history/form layouts checked at widths 320, 360, 375, 390, 412, 480, 768, 1024, 1366 and 1920px. No horizontal document overflow; new controls at least 44px; existing bottom navigation retained. Browser console errors: none.
- A read-only raw BSON hash comparison confirmed configured financial records unchanged, including the existing 700-rupee receipt. No test financial records or follow-up notes were created in Atlas.
- Updated normal backend connected successfully and serves the new endpoint on port 5000. Unauthenticated requests return 401.
- No real-phone calls or WhatsApp messages were made. Real Android dialer/WhatsApp handoff remains a manual acceptance check.

Screenshots contain synthetic data: docs/screenshots/follow-ups/admin-desktop.png, admin-mobile.png and employee-mobile.png.
