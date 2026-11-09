# Smart notifications — Royal Enterprises LMS

## User navigation and implemented behavior

Both portals: header bell → compact unread dropdown → View all notifications. Sidebar → Notifications opens /admin/inbox or /employee/inbox. Existing Admin Missed Payments remains at /admin/notifications.

The bell shows the actual unread count, capped visually at 9+, and hides its badge at zero. It loads the latest six unread records in a 375px desktop panel, at most 420px high, with category icons, readable two-line descriptions, IST dates and a gold unread dot. Close, Escape, outside activation and keyboard activation of the profile menu dismiss it. Mark all read leaves a check icon and You're all caught up. History retains all records, with search, categories, unread filter, newest-first ordering, pagination, View and Mark Read. History supports compact mobile cards and touch targets. No sounds; dropdown animation respects reduced motion.

The existing authenticated Bearer SSE transport is reused. It reconnects with backoff and reloads persisted state, with a 30-second fallback while disconnected. Scoped storage invalidation and SSE synchronize tabs. Read updates retain the first read timestamp on repeated requests. Opening an alert checks recipient ownership and current destination authorization on the server before marking it read. Missing or reassigned records return a clear error; no unrelated record is substituted.

Payments open their exact existing receipt. Admin receipt actions include View Customer, View Employee, View Loan and the existing idempotent customer receipt review operation. Review stays separate from company funds/settlement verification. KYC opens its exact application; approved Employee KYC alerts open the exact authorized customer. Legacy basic customer requests show the selected existing request. Loan alerts open the existing loan. Settlement alerts open the exact audit/proof panel. Overdue/reminder alerts identify the loan, customer and actual unpaid balance. Account requests open Settings with a scoped exact request filter. Customer assignment events notify the currently assigned employee.

Notifications are dispatched from committed audits using the existing durable dispatch table and unique recipient/role/event key. New assignment-event support has its own activation marker, so it cannot replay historical assignments. Daily reminder keys include business day, category and loan. Reminders use integer-paise outstanding schedule balances, including partial/advance coverage, and do not write financial data.

## Existing records and data safety

The configured Atlas database remains loan_management. Existing COL000005 alerts were inspected read-only: six records represent payment/review events across two Admin recipients and the Employee, rather than six independent collections. Generic historical payment alerts are enriched on read from the actual receipt, employee, customer and loan. The existing receipt remains ₹800 with allocations ₹700 and ₹100. Loan outstanding remains ₹19,500; the full prior read-only financial reconciliation, including cashbook/custody/settlement dependencies, matches unchanged.

A read-only Atlas check of the new legacy-search aggregation found the original generic alert by COL000005, CUS000001, EMP0001 and ₹800. Automatic collection/index creation was disabled for this diagnostic, and its before/after alert JSON was identical. The search joins are scoped to the authenticated recipient and authorized payment ownership; intermediate joins, audit payloads and recipient identifiers are stripped before responses. No historical backfill, notification deletion, financial repair, customer/loan/payment recreation or configured test financial transaction was performed. Existing notification fields/read states and COL000005 references were unchanged in the final comparison. All browser financial submissions used a disposable MongoMemory database.

## Files created or modified

Backend:

- src/models/UserNotification.js — optional category and related-record IDs, scoped unread/update indexes; existing unique event index retained.
- src/services/inbox.service.js — meaningful event descriptions, customer-assignment support, current loan reminders, filtered/paginated reads, atomic read behavior, generalized opening and SSE read-state invalidation.
- src/services/notificationTarget.service.js — category classification and authorized exact destinations.
- src/services/notificationSearch.service.js — read-only legacy receipt/identity/code/amount search without backfill.
- src/services/paymentNotification.service.js — exclude missed/waiver/non-monetary entries from actual payment enrichment.
- src/routes/notification.routes.js — scoped unread-count endpoint and safe default request arguments.
- src/services/collection.service.js — read-only receipt IDs/review eligibility for authorized receipt actions; payment calculations/posting unchanged.
- src/services/settings.service.js — scoped request-ID filter for exact account-request navigation.

Frontend:

- src/components/NotificationBell.jsx — compact unread panel and existing SSE lifecycle.
- src/components/NotificationItem.jsx — shared category icons, descriptions, unread dots and IST times; Admin entries say recorded rather than inventing physical collection by Admin.
- src/components/notification-bell.css — responsive panel, history cards, touch controls and reduced-motion styling.
- src/hooks/useNotifications.js — shared fetching, read/open actions and tab invalidation.
- src/pages/shared/NotificationHistory.jsx — saved history, filters/search/pagination and selected legacy request summary.
- src/pages/admin/CustomerLeads.jsx — authorized selected-request preview using existing API.
- src/pages/shared/Settings.jsx — exact request filter on notification navigation.
- src/pages/employee/Receipt.jsx — shared Admin receipt links and review, outside the printed receipt.
- src/components/LoanDetailsView.jsx — clear unavailable/access-changed error with Retry/Back instead of silently redirecting notification visitors.
- src/layouts/PortalShell.jsx — Notifications navigation in both portals.
- src/App.jsx — both protected inbox routes; original Missed Payments route retained.

Tests:

- backend/tests/integration/inbox.integration.test.js — exact destinations, read persistence, filters/counts/search/pagination, activation boundary, changed ownership, two live streams/reconnection and legacy/account-request paths.
- backend/tests/integration/paymentNotifications.integration.test.js — legacy search by real receipt context with immutable stored alert.
- backend/tests/integration/kyc.integration.test.js — notifications from actual committed KYC submission/approval and exact customer navigation.
- frontend/tests/smartNotifications.test.mjs — badge, icons, real descriptions, read/unread states, both history portals and missing-payment/Admin-entry wording.

No dependencies added. No financial schemas, loan calculations, KYC storage, passwords, receiving accounts, logo or configuration changed.

## APIs

All use existing JWT authentication and recipient/role ownership:

- GET /api/v1/notifications/inbox?unread=true&limit=6 — latest unread list plus global unread count.
- GET /api/v1/notifications/inbox?page=1&limit=20&category=PAYMENTS&search=... — retained history; categories ALL, PAYMENTS, KYC, LOANS, SETTLEMENTS, REMINDERS, CUSTOMERS, SYSTEM.
- GET /api/v1/notifications/inbox/count — unread count only.
- PATCH /api/v1/notifications/inbox/:id with unread:false — atomic scoped read update, preserving an existing read timestamp.
- POST /api/v1/notifications/inbox/read-all — only the authenticated recipient's unread records.
- POST /api/v1/notifications/inbox/:id/open — validates and resolves the exact destination, then marks read. Payment actions support receipt, customer, employee and loan, subject to existing permissions.
- GET /api/v1/notifications/stream — Bearer-authenticated SSE, revocation checks, heartbeats, connection limits and invalidations.

Existing receipt GET adds customer/employee IDs and provenance-based review eligibility; existing verification endpoint is reused. Existing settings requests GET accepts requestId while preserving role/owner restrictions.

## Executed checks

- Backend npm test -- --runInBand: 36 suites, 303 tests passed; existing coverage gates passed.
- Frontend node --test tests/*.test.mjs: 81 passed.
- Frontend ESLint: passed.
- Vite production build: passed, output tmp/smart-notifications/build-final to preserve existing tracked dist work.
- Targeted legacy/inbox integration diagnostics: 25 passed, followed by the complete backend run above.
- Real Atlas legacy search and before/after financial/alert reconciliation: PASS, read-only.

Isolated browser tests:

- Employee records a new ₹800 receipt through existing allocation confirmation; both open Admin tabs receive exactly one new payment event without reload.
- Admin click opens the exact ₹800 receipt; count decreases and second Admin tab displays Read.
- Admin reviews the receipt; Employee receives a live verification alert and its click opens that exact receipt.
- Employee submits a ₹100 cash settlement from actual isolated collection custody to a synthetic cash counter; Admin receives a live alert and opens the exact settlement audit/proof record.
- Mark all read clears counters across tabs, shows caught-up state, retains history and survives refresh plus logout/login for both roles.
- History category and receipt-code search return the correct record; read rows remain accessible. Employee history contains no other employee's customer.
- Close, Escape, outside click and keyboard profile-menu activation work without overlapping menus.
- Admin and Employee panels measured at 320, 375, 390, 430, 768, 1024, 1366 and 1920 CSS px. Panel stays within viewport, has no horizontal overflow, and is at most 420px high. History also measured across these widths; checkbox is 18px with a touch-friendly label.
- Mobile panel visually inspected and screenshots saved. An actual scrollbar-width clipping defect and oversized checkbox styling were found, fixed and rechecked.
- Browser console error checks were clean on completed test views. Disposable tabs/servers were cleaned up. The normal frontend responds HTTP 200 on 5173; backend connects to MongoDB on 5000.

API integration coverage also exercises real KYC submission/approval transactions, corrections/rejection, customer assignment, loans, settlement destinations, legacy requests, account requests, overdue reminder destinations, unauthorized access, rollback non-delivery, duplicate dispatch and reconnection.

## Limits and manual acceptance

Physical Android/iPhone devices and an externally hosted reverse proxy were not tested. Temporary-network recovery is covered through SSE reconnection tests; a physical phone switching Wi-Fi/mobile data remains a manual acceptance check. KYC/assignment/rejected-settlement notification navigation is covered by API integration and existing destination workflows, not a newly executed full browser form run in this task. Receipt PDF generation/printing is unchanged and was not re-tested for this notification task.

Refresh http://localhost:5173 and use each real account's bell and Sidebar → Notifications. Search COL000005, verify the actual ₹800 receipt/identities, mark a notice read and confirm another tab synchronizes. View all keeps it in history. Repeat after logout/login. Test existing KYC and settlement decisions as genuine business operations or in an isolated environment; do not enter artificial financial data into the configured database. On a real phone, check opening/closing the panel, tapping a record, history filters and Wi-Fi/mobile-data reconnection.

Evidence and logs: tmp/smart-notifications/. Screenshots: admin-dropdown-mobile.png and employee-dropdown-mobile.png, both using isolated synthetic test records.

## Reverification and compatibility fixes — latest request

This pass reused the complete system above. It did not create another inbox, transport, notification collection, financial workflow or historical backfill.

### Confirmed issues corrected

1. A legacy stored `CUSTOMER_PAYMENT_VERIFIED` kind could bypass the canonical `PAYMENT_VERIFIED` check and render as a newly received payment. Payment enrichment now normalizes legacy kinds on read and gives the committed audit action precedence over stale labels. Stored alerts and financial records are unchanged.
2. Legacy receipt search joined the custody/assignment `employeeId`, while the rendered receipt identity used the actual `collectedBy`. Search now uses the recorded collector, matching the displayed identity without changing financial attribution.
3. The desktop dropdown used a fixed viewport-right position instead of anchoring below the bell. It is now anchored to the bell from 768px upward, with the constrained mobile panel preserved. Close-button colors are explicit so a dark parent theme cannot make its icon unreadable on the white panel.
4. Read/open actions now have one pending operation per surface, visible disabled/busy controls and reliable retry cleanup. Redundant feed reads are cancelled on refresh, filter change and unmount. Existing authentication, authorization and server-side idempotent read handling remain authoritative.

### Files changed in this pass

- `backend/src/services/paymentNotification.service.js`
- `backend/src/services/notificationSearch.service.js`
- `backend/tests/integration/paymentNotifications.integration.test.js`
- `frontend/src/components/NotificationBell.jsx`
- `frontend/src/components/notification-bell.css`
- `frontend/src/hooks/useNotifications.js`
- `frontend/src/pages/shared/NotificationHistory.jsx`
- `frontend/src/utils/notificationAction.js` (new)
- `frontend/tests/notificationAction.test.mjs` (new)
- This report and `docs/screenshots/notification-completion/`.

No dependencies, schemas, indexes or API contracts changed in this pass. The existing authenticated notification APIs listed above are reused.

### Checks executed in this pass

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Backend suite | PASS | 36 suites, 307 tests; disposable MongoDB instances |
| Frontend suite | PASS | 89 tests, including pending-action retries and overlap prevention |
| Frontend lint | PASS | `npm run lint` |
| Production build | PASS | Isolated output `tmp/notification-completion/build`; existing generated files preserved |
| Payment → Admin live delivery | PASS | New isolated ₹800 receipt appeared in two open Admin tabs without refresh, with correct collector/customer |
| Exact Admin receipt and read state | PASS | Notification opened the new receipt ID; count changed from 6 to 5 across tabs |
| Admin review → Employee notification | PASS | Actual isolated review produced the verification notification, which opened the same receipt |
| Mark Read / Mark All Read / history | PASS | Individual read removed the result from unread filtering; all-read reached zero, hid badge and retained 7 Admin / 6 Employee history records |
| Refresh and logout/login persistence | PASS | Both roles retained zero unread after login; read history remained accessible |
| Search and category filters | PASS | Browser payment-category / exact receipt-code search; API tests also exercise literal identity/amount search and pagination |
| Role and ownership isolation | PASS | API cross-recipient/changed-assignment checks; Employee browser history excluded the other employee's customer |
| KYC submission/approval/corrections | PASS, API integration | Actual isolated KYC transactions, committed notifications and exact authorized destinations; not a new complete browser form run in this pass |
| Loan/customer/account-request navigation | PASS, API integration | Exact record resolver, assignment checks, direct request filters and missing-record behavior |
| Settlement submission/review/navigation | PASS, API integration | Existing settlement workflow suite and exact notification resolver; not a new browser settlement submission in this pass |
| Overdue/follow-up reminders | PASS, API integration | IST business-day grouping, mature unpaid balances, exact loan links and duplicate suppression |
| Rollback, retries and duplicate events | PASS, API integration | Failed financial operations publish no alert; repeated dispatch does not duplicate business events |
| SSE reconnect / multiple tabs / revocation | PASS | API stream tests and live two-tab browser updates; no new transport was introduced |
| Mobile and desktop layouts | PASS, viewport emulation | Both roles measured at 320, 375, 390, 430, 768, 1024, 1366 and 1920px; no page overflow; panel inside viewport and at most 420px high |
| Close / Escape / outside activation | PASS | Browser checks; zero unread shows the check icon and caught-up message |
| Browser console | PASS | No captured errors on completed Admin/Employee verification views |
| Normal local servers | PASS | Frontend HTTP 200 on 5173; backend connected to MongoDB on 5000; unauthenticated unread-count endpoint HTTP 401 |
| Physical phones / real network switching | NOT VERIFIED | Android/iPhone hardware and Wi-Fi/mobile-data handover remain manual checks |

Browser checks crossed midnight in Asia/Kolkata. Reminder timestamps and the newly recorded isolated receipt correctly moved to the new business day; dates were not hardcoded or rewritten.

### Configured database safety

Read-only Atlas diagnostics confirmed database `loan_management`, original receipt `COL000005` amount ₹800 and six existing related alerts. Original alert search succeeded by receipt, customer code, employee code and amount; the inspected stored alert remained byte-for-byte unchanged. The protected receipt/loan/schedule/cashbook/custody reconciliation matched the previous verified snapshot. No historical backfill or configured financial test record was created. All browser submissions above used a separate disposable local database.

### Browser acceptance

Use the header bell or Sidebar → Notifications at `/admin/inbox` and `/employee/inbox`. Open an existing payment alert to verify its exact receipt; search `COL000005` in authorized Admin history to inspect the original ₹800 receipt. Mark an alert read and confirm a second tab synchronizes; refresh and sign in again to confirm persistence. Read alerts remain under All notifications. Use genuine business operations or isolated test data for KYC and settlement acceptance; do not add artificial collections to the configured database.

New screenshots contain only isolated synthetic records:

- `docs/screenshots/notification-completion/admin-desktop.png`
- `docs/screenshots/notification-completion/employee-mobile.png`

Raw check logs, read-only diagnostic outputs and width measurements are stored locally under `tmp/notification-completion/`. Physical-phone testing, reverse-proxy deployment and network handover were not performed.
