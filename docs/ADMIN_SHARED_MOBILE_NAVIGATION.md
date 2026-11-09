# Shared Admin mobile navigation fix

## Root cause
All pages already used PortalShell, but multiple route-specific styles independently changed its header geometry. Dashboard/Employees/Loans/Reconciliation used different `display: contents`, flex ordering, avatar/branding sizes and media breakpoints. Missed Payments additionally positioned its hamburger absolutely on the left, while Follow-ups and Settings inherited the base header. Switching routes therefore changed the shared header's structure and alignment. Page-specific content padding also overrode clearance for the fixed bottom navigation.

## Shared implementation
- A stable `admin-portal-shell` class now applies to every Admin route.
- `admin-mobile-shell.css` owns mobile/tablet header, drawer, backdrop, bottom navigation geometry and safe-area spacing at widths below 1024px. Following the updated placement request, the hamburger is first on the far left, followed by the logo; notification and profile controls stay right with 44px targets.
- Removed 74 conflicting page-header rules with a CSS AST migration, plus the leftover standalone Missed Payments absolute-position rule. Existing desktop theme rules and page content styling remain.
- The drawer is fixed to the left, constrained to the viewport, slides from negative X to zero, and sits above its dimmed backdrop/content. Its existing X, menu-item close, Escape and focus trapping remain.
- Admin drawer locking now fixes the body while open for iOS-style scroll prevention and restores captured scroll position/styles on close. Employee overflow-lock behavior remains as before.
- `PortalBottomNavigation` renders the existing five destinations in a stable order. Compact visual labels retain full accessible names. Active states come from existing React Router matching, including Settings queries and nested customer routes. Pages absent from the five destinations do not falsely highlight Dashboard.
- Every Admin page receives bottom clearance for the bar and `safe-area-inset-bottom`. The existing KYC action footer uses the same bar-height variable so its buttons do not overlap navigation. Keyboard-open behavior remains shared.
- Settings sections wrap in a two-column mobile / three-column tablet grid; the form stays within the viewport. No Settings or Follow-ups action/API was changed.
- At 1024px and above, existing desktop sidebar and header geometry remain in effect.

## Changed files
Shared layout:
- `frontend/src/layouts/PortalShell.jsx`
- `frontend/src/layouts/PortalBottomNavigation.jsx` (new shared component)
- `frontend/src/layouts/admin-mobile-shell.css` (new shared styles)
- `frontend/src/hooks/useMobileNavigation.js`
- `frontend/src/pages/shared/Settings.jsx` (Admin wrapper class only)

Removed conflicting header-positioning rules from:
- `frontend/src/pages/admin/admin-dashboard.css`
- `frontend/src/pages/admin/missed-payments.css`
- `frontend/src/components/employees/employees.css`
- `frontend/src/components/customers/admin-customer-details.css`
- `frontend/src/components/reconciliation/reconciliation.css`
- `frontend/src/components/admin-loans/admin-loans.css`

Tests:
- `frontend/tests/adminNavigation.test.mjs` (new)

## Executed checks
- **195 frontend tests passed**, including stable bottom-navigation ordering, compact/accessibility labels, nested/query active states and no false Dashboard highlight.
- Frontend lint passed.
- Final production build passed.
- Browser checks used disposable MongoMemoryReplSet data and ports 5020/5190. No configured-database sample records or financial writes were made.
- All ten main Admin destinations tested: Dashboard, Employees, Customers, Customer Approvals, Loans, Collections & Installments, Missed Payments, Overdue Follow-ups, Daily Reconciliation, Settings.
- Tested all nine requested widths: **320, 375, 390, 430, 768, 1024, 1366, 1440, 1920px**. The nine non-Settings pages produced 81 route/width checks; Settings added nine more. All passed page-overflow, single-navigation and responsive bar/header checks.
- Mobile/tablet: 68px header (plus real-device top safe inset when present), one fixed bottom bar, closed drawer offscreen to the left. Laptop/desktop: sticky left sidebar, 76px existing header, mobile bar hidden.
- Requested Missed Payments → Overdue Follow-ups → Reconciliation → Settings sequence passed. Drawer menu-item navigation closed it automatically each time and restored body styles.
- Repeated drawer opens/closes, X, Escape, backdrop dismissal, keyboard wrap and browser back/forward passed.
- All ten Settings sections tested at 320px with correct Settings bottom highlight and no page-level horizontal overflow. The permissions table retains its intentional local horizontal scrolling.
- Scrolled to Settings controls; Save personal details could be focused above the bottom bar without submitting. Body locking/restoration was checked while scrolled.
- At 320px, measured branding and notification/profile/menu bounds do not overlap; each icon target measures 44px. Drawer bounds were left=0, right=276 inside the 320px viewport.
- No browser console errors. Financial collection hashes before/after read-only QA matched.

## Limits / manual phone checks
These were Chromium browser viewport tests, not physical Android Chrome or iPhone Safari tests. Actual nonzero iPhone safe-area values, Safari rubber-band scrolling and browser toolbar behavior require a real phone. Existing `viewport-fit=cover` plus top/bottom `env(safe-area-inset-*)` and `100dvh` are retained/used, but physical Safari verification is not claimed.

On a phone, repeat the four-page sequence, open/close the drawer after scrolling, focus Settings inputs with the keyboard, and check the bottom bar above the iPhone home indicator. No backend API, calculations, financial records or configured MongoDB data were changed.

## Screenshots (synthetic QA data)
- `docs/screenshots/admin-navigation/settings-320.jpg`
- `docs/screenshots/admin-navigation/drawer-320.jpg`
- `docs/screenshots/admin-navigation/follow-ups-390.jpg`
- `docs/screenshots/admin-navigation/reconciliation-390.jpg`

## Follow-up: Admin hamburger moved to the left

The user clarified that the header menu icon, as well as the drawer, must be on the left. `PortalShell.jsx` now renders the Admin mobile trigger directly before the logo instead of inside the right action group. `admin-mobile-shell.css` controls that shared ordering. Employee placement and desktop sidebars are preserved.

Verified at 320, 375, 390, 430, 768px: exactly one menu trigger, left=8px, width=44px, no horizontal page overflow. At 1024/1366px the mobile trigger is hidden. Missed Payments, Overdue Follow-ups, Daily Reconciliation and Settings all retain the same left trigger. The drawer bounds were left=0 and right=296 at 390px. No console errors. All 195 frontend tests, lint and build passed. No backend/data changes. Screenshots: `docs/screenshots/admin-menu-left/settings-390.jpg`, `drawer-390.jpg`.

## Follow-up: match Employee mobile header

Updated only `frontend/src/layouts/admin-mobile-shell.css` to match the Employee reference: hamburger left, truly centered original logo, notification bell right, no mobile profile avatar, matching navy-black header and red unread badge. Desktop profile/header and left drawer behavior remain available as before. Settings stays accessible from the bottom navigation/drawer.

Verified logo center error = 0px at 320, 375, 390, 430, 768px with no horizontal overflow. Desktop mobile branding/trigger remain hidden and profile menu remains visible at 1024/1366px. Actual Admin login and drawer navigation to Settings passed. Console error log empty. Lint, build and all 16 targeted navigation/Settings/notification tests passed. No backend/database changes. Latest screenshots: `docs/screenshots/admin-header-match/dashboard-390.jpg`, `settings-390.jpg`.
