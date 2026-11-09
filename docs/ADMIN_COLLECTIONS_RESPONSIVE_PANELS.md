# Admin Collections & Installments redesign

Implemented 7 November 2026 using the supplied Collections & Installments Dashboard Mockup (2) and its accompanying brief.

## Application files changed

- `frontend/src/components/collections/AdminCollections.jsx`: compact full-width overview and existing server-filtered list integration.
- `frontend/src/components/collections/AdminInstallmentPresentation.jsx`: compact table, numbered rows, initials avatars, status badges and mobile cards.
- `frontend/src/components/collections/admin-collections.css`: scoped responsive page styles.
- `frontend/src/components/collections/PaymentPanel.jsx` (new): shared native dialog, focus containment, Escape/Back handling, scroll locking and restoration.
- `frontend/src/components/collections/payment-panel.css` (new): full-screen mobile panel, desktop dialog, single scrolling body, safe-area header/footer.
- `frontend/src/components/collections/PaymentReviewModal.jsx`: shared read-only history and Admin review, receipt/allocation distinction, remarks, confirmation, duplicate-submit guard, loading/error/retry/success states and authenticated receipt download.

Tests: `frontend/tests/paymentPanel.test.mjs` (new), `frontend/tests/installmentHistory.test.mjs` (presentation assertions updated).

No backend APIs, authentication, financial calculations, configured database records, main sidebar, header or logo were changed. Other pre-existing uncommitted changes were preserved.

## Behavior

- Eight compact overview tiles use existing API values. The final metric remains **Installments** unless the API supplies an actual distinct `customerCount`; a customer count is never inferred from a paginated result.
- Search, employee/payment-status filters, scope tabs, pagination and existing collection refresh hooks remain active.
- Uncollected installments show Awaiting Employee Collection and an explanatory message, with no History action.
- History is installment-specific and read-only. Full receipt totals and allocations against the selected installment are labeled separately. Other allocations expand within the receipt card; original received/entered dates, collector and review remarks remain visible.
- Review requires explicit confirmation before the existing verification POST. Multiple eligible receipts require selection. Repeated clicks are guarded. A successful POST followed by a failed refresh blocks further verification until history reloads.
- Customer payment review remains separate from employee-to-company settlement.
- Mobile History/Review fill the viewport with one scroll area and accessible fixed action footer. Desktop uses a centered bounded dialog. Native dialog focus containment and Escape are supported; browser Back closes the panel and restores list scroll/filters.

## Executed verification

| Check | Result |
| --- | --- |
| Frontend Node tests (`node --test --test-concurrency=1 tests/*.test.mjs`) | PASS: 216, zero failures/skips |
| Frontend ESLint (`npm run lint`) | PASS |
| Frontend production build (`npm run build`) | PASS |
| Backend (`npm test -- --runInBand`) | PASS: 48 suites, 434 tests, coverage gates passed |
| Page, Review and History layout measurements | PASS at 320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920px |
| Search, status/employee filter request, reset, scopes, pagination | PASS in isolated UI fixture; employee ownership/filter semantics also covered by backend tests |
| Uncollected action, no history, empty/loading/list error/retry | PASS |
| Review confirmation before POST; double-click prevention | PASS: confirmation first, one POST on double-click |
| Failed verification retry; saved-review refresh failure | PASS: errors visible, retry works, saved verification cannot be duplicated |
| History error/reload; 80-entry history at 320px | PASS: internal scrolling, expanded allocations, visible footer |
| Employee read-only History, Escape, browser Back, scroll restoration | PASS |
| Receipt navigation and authenticated download UI | PASS with synthetic route/download fixture |

Backend tests used isolated test databases. Browser tests used the actual React components and shared shell with a local Axios adapter on port 5180, synthetic rows and in-memory verification state. They did not call or write the configured MongoDB database. The receipt destination/download fixture checks UI routing and download behavior; it is not proof of live receipt PDF rendering. Two earlier development HMR warnings came from reinitializing the temporary fixture, not the application components.

## Screenshots and logs

Screenshots contain clearly labeled synthetic QA data:

- `tmp/collections-redesign/final-desktop.jpg`
- `tmp/collections-redesign/final-mobile.jpg`
- `tmp/collections-redesign/final-review.jpg`
- `tmp/collections-redesign/final-history.jpg`

Evidence: `responsive-checks.json`, `final-widths.json`, `frontend-final.log`, `build-final.log`, `backend-tests.log` in the same folder. Temporary fixture source is `entry.jsx` / `serve.mjs`, outside application source/build entry points.

## Remaining manual acceptance

Real Android Chrome and iPhone Safari (including actual notch/safe-area and soft keyboard behavior) were not tested. Browser automation covered emulated viewport widths, not physical devices. On an authorized account, open Admin > Collections, check an existing partial/advance receipt, open History/Review, cancel without modifying records, and view/download its real receipt. Confirm live account-specific data and real PDF rendering. No live payment verification was performed during this UI task.
