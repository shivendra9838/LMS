# Admin Customer Requests redesign

Target: `/admin/customers/requests`.

Implemented the supplied desktop/mobile reference in the existing application. Original branding, sidebar/header, notification bell, direct-customer route and KYC approval workflow remain in place.

## Interface

- Navy/black surfaces, gold primary action, compact status cards and Lucide icons.
- Four clickable summary cards and horizontally scrollable status tabs, using backend counts. Selecting a summary card also brings its selected tab into view on mobile.
- Server-side name, customer code, mobile and referring-employee search; referring employee selector; date presets/custom range; newest/oldest sorting; Clear and Refresh.
- Desktop table includes actual customer photo/initials, name/code, original referring employee, phone, request date, status and accessible actions. Mobile uses stacked cards with labeled touch controls.
- Collapsible mobile filters retain their values. Employee selectors retrieve bounded search results, rather than downloading every employee or customer.
- Separate loading, error-with-Retry and compact empty states. The measured mobile empty state is approximately 163px high, replacing the old 320px minimum rectangle.
- Secure photos use existing authenticated customer/KYC APIs and revocable blob URLs. Missing photos use initials. Missing customer IDs are identified without inventing a code.
- Existing notification-selected-request preview remains available.

## Workflows and data definitions

- Approved requests retain their actual statuses and customer links. They never offer a duplicate approval/rejection action.
- Pending complete KYC applications open the existing full KYC/review route, including its correction, rejection, allocation, document, PDF, print and history controls. No abbreviated approval path was introduced.
- Legacy referrals retain their existing approve-and-allocate and reject APIs. A readonly referral modal adds basic details; rejection now uses a labeled reason dialog instead of a browser prompt. Submission locks and busy controls prevent repeated UI submissions.
- Referring employee remains the original `submittedByEmployeeId`; allocating a different servicing employee does not rewrite attribution.
- Successful legacy actions immediately refetch counts and rows. The existing notification/focus/15-second refresh hook also refreshes the page without a full reload.
- Counts reflect the applied search, referring employee and date filters across all four supported statuses, before pagination. Drafts remain excluded from the Admin request lists as before. An approved customer's in-progress draft/revision is not silently relabeled as a newly approved request; the approved customer and snapshot remain accessible through their existing routes.
- Request dates use the latest recorded `SUBMITTED` history timestamp when available, otherwise the original request creation timestamp. Filters use Asia/Kolkata day boundaries; no timestamps are rewritten.

## Backward-compatible API addition

Existing `GET /api/v1/customer-leads` supports an optional **Admin-only** `requestDirectory=true` mode. It returns safe paginated metadata for both legacy and complete KYC requests, with `meta.counts`. Optional `employeeId` and `sort=newest|oldest` filters apply in this mode.

The previous default listing and Employee KYC directory remain unchanged. New filter validation is scoped to the new mode, including a regression check that older calls retain their previous behavior. Authentication and active-account checks still run before listing. Employees cannot access the Admin directory mode.

No encrypted KYC payloads, identity numbers, document bytes, private storage paths or public document URLs are returned by the new directory projection. No models, migrations, loan/payment calculations, mutation services or approval permissions were changed.

## Files changed

Paths relative to `C:/Users/shive/Desktop/LMS`:

- `frontend/src/pages/admin/CustomerLeads.jsx`
- `frontend/src/components/requests/RequestPresentation.jsx` — new shared cards, rows, identities, actions and private photo presentation
- `frontend/src/components/requests/presentation.js` — new status, routing and filter helpers
- `frontend/src/components/requests/customer-requests.css` — new scoped styles
- `frontend/src/layouts/PortalShell.jsx` — scoped Requests shell theme
- `backend/src/services/customerRequestDirectory.service.js` — new read-only projection
- `backend/src/services/customerLead.service.js` — optional listing dispatch
- `backend/src/validators/customerLead.validator.js` — optional mode-specific filters
- `frontend/tests/customerRequests.test.mjs` — new regressions
- `backend/tests/integration/customerRequestDirectory.integration.test.js` — new isolated integration tests
- This report and `docs/screenshots/customer-requests-ui/`.

Unrelated existing uncommitted changes were preserved. No dependencies were added.

## Executed verification

| Check | Result |
| --- | --- |
| Full backend Jest with original coverage gates | PASS — 40 suites, 359 tests; final compatibility rerun passed |
| Frontend test suite | PASS — 157 tests |
| ESLint | PASS |
| Vite production build | PASS — output under `tmp/customer-requests-ui/build` |
| Four status tabs and clickable summaries | PASS — disposable browser database |
| Approved records and absence of duplicate approval actions | PASS — existing approved fixture retained; approved customer link opened correctly |
| Search, referring employee, Today/IST filtering, Clear and pagination | PASS — browser checks; literal search, custom boundary ranges, sorting and scoping also covered by backend tests |
| Legacy referral view, approval/allocation and rejection | PASS — executed only in disposable MongoDB; reason required; counts updated immediately |
| Complete KYC route | PASS — opened the existing form and found approval/correction controls; existing backend tests cover review, reasons, authorization and document/snapshot workflows |
| Add Customer Directly | PASS — opened existing Add Customer page; no direct customer was created in the configured database |
| Loading/error/empty states | PASS — rendering regressions; browser empty state measured; no empty-success message during loading/error |
| Responsive layouts | PASS — 36 status/viewport combinations; no horizontal page overflow |
| Long names, missing photos and IDs | PASS — wrapping/fallback checked; approved missing-link behavior has a regression test |
| Mobile drawer and expanded filters | PASS |
| Browser console after clean reload | PASS — zero new captured errors |
| Normal backend/frontend startup | PASS — MongoDB connected, port 5000 health OK, normal route serves on port 5173 |
| Authenticated configured-database record inspection | NOT VERIFIED — a fresh normal-site tab redirected to Admin login; no credentials or verification accounts were introduced |
| Physical Android/iPhone testing | NOT VERIFIED — browser viewport emulation only |

Widths: **320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920px**. Tables scroll inside their region on narrow tablets; mobile cards replace the table. Tabs scroll horizontally within their own navigation, without scrolling the page horizontally.

All backend and browser mutations used disposable MongoMemoryReplSet databases. The browser fixture ran separately on ports 5017/5187. No customers, KYC, assignments, loans, installments, payments or settlements were created, edited, seeded, reset or deleted in the configured Atlas database by this task. No financial repair or migration was performed. The normal application remains available; disposable QA servers were stopped after verification.

QA found and fixed a lint-only test import, desktop status-badge wrapping, active mobile tab visibility and the default network-error wording. All relevant checks were rerun. No tests or coverage requirements were removed or disabled.

## Screenshot evidence

All screenshot data is synthetic, isolated QA data rather than live customer information:

- `docs/screenshots/customer-requests-ui/desktop-1440.jpg`
- `docs/screenshots/customer-requests-ui/mobile-390.jpg`
- `docs/screenshots/customer-requests-ui/approved-mobile-390.jpg`
- `docs/screenshots/customer-requests-ui/empty-mobile-390.jpg`

## Manual acceptance

1. Sign in at `http://localhost:5173/admin/login`, then open `/admin/customers/requests`. Refresh once if the browser has older development styles cached.
2. Compare the four counts and Approved records with your own expected request states. Counts follow the applied search/employee/date filters.
3. Click summary cards and tabs; search by name, customer code, mobile and referring employee. Check custom dates, sorting, Clear and pagination.
4. Open an approved customer's details and KYC. For an intended pending application, use the existing full KYC review to inspect documents and perform corrections/rejection/approval with the required reason or employee selection.
5. Check the page on an actual Android phone, especially native date pickers, filter disclosure, tab scrolling, dialogs and navigation.

No unresolved automated failures remain. Your authenticated live-record acceptance and real-device checks remain manual.
