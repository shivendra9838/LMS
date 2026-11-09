# Admin Missed Payments responsive UI

UI-only update. The existing `/notifications` API, arrears calculations, receipt/payment records, loan routes and backend are unchanged.

## Files
- `frontend/src/pages/admin/MissedPayments.jsx`: retain desktop Date & Time / Message / Status / Action table; add mobile cards using existing structured API fields (date, loan number, customer, actual remaining amount, employee and unresolved status). Preserve View Loan navigation, loading, retry and empty states. General notice messages remain available; missing amounts are not fabricated as zero.
- `frontend/src/pages/admin/missed-payments.css`: scoped black-and-gold theme, readable headings, controlled table widths/spacing, wrapping for long identities, mobile cards and 44px actions. Cards apply at widths up to 768px; table remains above 768px.
- `frontend/src/layouts/PortalShell.jsx`: route-specific presentation class only. Reuses the existing hamburger, sidebar drawer, keyboard focus/Escape behavior and mobile navigation; no duplicate navigation.
- `frontend/tests/missedPayments.test.mjs`: desktop/mobile content, actual data, missing-field/general notice and accessible empty-state regressions.

## Executed checks
- Frontend lint passed.
- All **190 frontend tests passed**, including 3 new tests.
- Production build passed after final CSS changes.
- Browser tests used a disposable MongoMemoryReplSet database and isolated frontend/API at ports 5190/5020. No configured-database customer or financial test records were created.
- Viewports **320, 375, 390, 768, 1024 and 1366px**: no page horizontal overflow. Cards displayed through 768px and desktop table at 1024/1366px. Long customer and employee names wrapped without overlapping or overflowing.
- Open menu, close using Escape, and View Loan from a mobile card passed. Correct existing loan route opened.
- Fixed the page-specific theme scope after visual QA found a light-appearance setting made the white heading unreadable. Final measured heading/background contrast is light text over dark background at all tested widths; account preferences were not changed.
- Browser console had no errors.
- Before/after hashes of disposable customer, loan, schedule, payment, custody, settlement and cashbook collections matched after read-only browser interactions.
- Browser viewport testing only; no physical Android-device testing is claimed.

## Screenshots
- `docs/screenshots/missed-payments/mobile-320.jpg`
- `docs/screenshots/missed-payments/mobile-390.jpg`
- `docs/screenshots/missed-payments/desktop-1366.jpg`

Open Admin → Missed Payments (`/admin/notifications`) on the normal website. Resize the window or use mobile viewport mode; the same records and loan actions remain available.
