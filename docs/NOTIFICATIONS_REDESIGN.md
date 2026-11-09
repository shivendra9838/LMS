# Admin and Employee notification redesign

Implemented on 5 November 2026. Existing notification dispatch, authenticated SSE, source records and authorized destination resolution are reused.

## Behavior

- The shared header bell remains available regardless of optional dashboard activity preferences. No dedicated inbox item is added to sidebars or bottom navigation. Missed Payments remains a separate financial screen.
- At 768px and above, the bell opens a 410px dropdown with the latest six saved notifications, read-all, four category tabs, live unread counts and the full-inbox link. Outside click and Escape close it.
- Below 768px, the bell opens the existing portal inbox route. Cards include actual event descriptions, IST timestamps, category icons and unread indicators.
- Swipe left dismisses; Undo restores. Swipe right marks read. Vertical scrolling, short drags and multi-touch do not invoke a swipe action. The card menu provides accessible alternatives.
- Dismissal is recipient-scoped and persisted. It does not delete the notification or its customer, loan, payment, settlement, KYC or audit source. Dispatcher retries preserve dismissal.
- Payments includes customer payments and settlements. Loans includes loans and installment reminders. System includes KYC, customer, account and security events. Tab counts are global active-inbox totals; search and detailed filters affect displayed rows.

## Files

Backend: `src/models/UserNotification.js`, `src/services/notificationTarget.service.js`, `src/services/inbox.service.js`, `src/utils/notificationGroups.js`, `src/routes/notification.routes.js`, `tests/integration/inbox.integration.test.js`.

Frontend: `src/components/NotificationBell.jsx`, `NotificationItem.jsx`, `NotificationCard.jsx`, `NotificationCategoryTabs.jsx`, `notification-bell.css`; `src/hooks/useNotifications.js`; `src/utils/notificationSwipe.js`; `src/pages/shared/NotificationHistory.jsx`, `Settings.jsx`; `src/layouts/PortalShell.jsx`; `tests/notificationSwipe.test.mjs`, `notificationPreview.test.mjs`, `smartNotifications.test.mjs`.

## API and storage

- Existing inbox listing supports optional `group=ALL|PAYMENTS|LOANS|SYSTEM` and returns category counts.
- New authenticated `POST /api/v1/notifications/inbox/:id/dismiss` and `POST /api/v1/notifications/inbox/:id/restore` routes.
- Optional `UserNotification.dismissedAt` field. Existing documents require no migration. Listing, counts, read-all and opening consistently exclude dismissed rows. Both operations enforce existing role and recipient authorization.

## Executed checks

- Frontend ESLint: PASS.
- Frontend tests: 198 passed, zero failed.
- Frontend production build: PASS.
- Backend: 43 suites / 379 tests passed, coverage gates passed.
- Dedicated inbox integration: 21 tests passed, including recipient isolation, dismissal/Undo persistence, legacy grouping, dispatcher deduplication, SSE updates and unchanged source-record hashes.
- Browser: disposable MongoMemoryReplSet only; Admin and Employee login, mobile bell routing, category filters, read-all, secure exact receipt links and back navigation verified. Admin pointer gestures verified dismissal, Undo, read, no accidental vertical-drag navigation, refresh persistence and synchronization to a second open inbox.
- Both inboxes measured at 320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920px. No horizontal document/card overflow. Admin dropdown bounds checked at tablet/laptop/desktop sizes. Escape and outside close checked. No application console errors observed.
- Disposable browser-test source-record hash check: unchanged after notification interactions. No synthetic records were written to configured Atlas.
- Local configured backend restarted to activate routes; health endpoint checked.

Screenshots: `screenshots/notification-redesign/admin-dropdown-1366.jpg`, `admin-payments-mobile.jpg`, `employee-payments-mobile.jpg`.

## Manual checks

Open either portal's bell, switch categories, open a relevant event, and test read-all. On a real phone, swipe left/Undo and right, then refresh to confirm persistence. Physical Android/iPhone and Safari safe-area/gesture behavior were not tested; responsive checks used browser viewport emulation. Event permissions and delivery tests cover existing event mechanisms, rather than creating every possible financial event in the configured database.
