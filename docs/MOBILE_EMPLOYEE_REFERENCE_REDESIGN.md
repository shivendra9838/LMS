# Employee mobile reference redesign

Implemented against `Royal Enterprises Employee Portal Dashboard.png`. This updates the actual React application; the reference's illustrative names, amounts and counts were not inserted into Atlas or hardcoded into the interface.

## Files and components

- `frontend/src/layouts/PortalShell.jsx`: adds the Employee-only mobile shell class and shared mobile branding. Existing drawer, notification, session and account actions are reused.
- `frontend/src/layouts/employee-mobile-shell.css` (new): authenticated Employee mobile header, with hamburger left, original contained emblem/company/tagline centered and live notification bell right. Applies to Employee portal pages below 1024px; desktop and Admin chrome retain their existing layout. Settings remains accessible from the existing drawer and bottom navigation.
- `frontend/src/pages/employee/Dashboard.jsx`: mobile styles, date-aware progress captions, activity pagination and tab scrolling beneath the sticky header.
- `frontend/src/components/dashboard/EmployeeWorkspace.jsx`: compact shared KPI rendering, receipt-aware mobile installment cards, real filter controls, timeline details and counts, paginated activity rendering and chart label support. Existing collection, history, receipt, customer and loan routes remain in use.
- `frontend/src/components/dashboard/employeePresentation.js`: presentation-only timeline status counts derived from the existing API rows. No posting, outstanding-balance or financial scoring calculations were introduced.
- `frontend/src/components/dashboard/employee-mobile.css` (new): mobile overview, 2×2 KPIs, full-width Collect Payment, timeline, chart, scrollable tabs/chips, stacked installment cards and activity feed. Mobile-only elements are hidden on desktop; the sidebar, four-column KPIs, two-column timeline/chart layout, table and activity sidebar remain intact.
- `frontend/src/components/directories/directory.css`: mobile-only KYC button/card refinements. Existing real counts, statuses, dates, protected photos, filters and authorized form actions are reused.
- `frontend/tests/mobileEmployeeDashboard.test.mjs` (new): regression tests for status counts, actual receipt versus allocation/carry-forward, locked collection actions, activity pagination/icons and zero-value chart-label rendering.

No backend API, schema, financial service, authorization rule, dependency, loan calculation, KYC workflow or database migration was changed. Existing uncommitted work was preserved. Production build output was written to `tmp/mobile-dashboard/build`, preserving existing dist changes.

## Financial checks

The existing backend remains authoritative. A selected date controls target, actual receipts and allocation-based remaining amounts. Scheduled target is not reduced by excess cash, receipts are counted once, and receipt review remains separate from company settlement.

Disposable test data verified:

- Three assigned customers: scheduled target ₹2,100, prior advance coverage ₹100 and remaining ₹2,000 on 29 October.
- Selected 28 October: scheduled ₹700, actual receipt ₹800, ₹100 early allocation, remaining ₹0.
- Original ₹800 receipt: Day 2 allocation ₹700; Day 3 allocation ₹100 and remaining ₹600.
- Day 3 exact history showed only its ₹100 allocation while retaining the full ₹800 receipt reference and the other ₹700 allocation.
- An additional ₹800 entry was previewed against Day 3: ₹600 there and ₹200 to Day 4. The browser test cancelled this form and did not post another payment.
- Receipt screen and payment tracking showed ₹800, actual received date versus entry date, Recorded status and separate Admin review/settlement states.

## Executed verification

- Backend: **39 suites / 327 tests passed**, including existing permission, notification, KYC, financial allocation and settlement coverage.
- Frontend: **107 tests passed**.
- ESLint: **passed**.
- Production build: **passed**.
- Dashboard and KYC page-overflow checks passed at **320, 360, 375, 390, 414, 430, 480, 768, 1024, 1366 and 1920px**. Phones retained two KPI columns and stacked cards. Desktop/tablet breakpoints retained the existing desktop table behavior. Desktop layout was visually inspected at 1366px; the four mobile views were inspected at 390px.
- Browser interactions exercised: hamburger/drawer, real notification bell, activity pagination, activity-to-exact-receipt navigation, persistent read state after refresh, date selection, Refresh, full-schedule route, mobile filter menu/chips/search, individual Collect form and allocation preview, history, breakdown, payment tracking and complete activity history. KYC tabs and View / Edit opened the existing form with its original preview/PDF/print controls.
- Opening the test ₹800 activity changed unread count from 11 to 10; 10 remained after refreshing. No notification events were fabricated by the UI.
- Tapping the chart displayed its actual received date and currency tooltip. Zero-receipt dates remain in the seven-day series. Accessible descriptions retain every business date and amount.
- Current configured financial/KYC collection hashes matched before and after testing. All browser fixture writes were confined to a separate disposable MongoDB Memory replica set. No Atlas sample customers, payments or applications were created.

During verification, the disposable Vite server briefly served a stale transformed module without its exports. An HTTP module inspection confirmed that the normal LMS frontend had the current exports while only the disposable server was stale. Restarting that test server resolved the error; fresh-load validation and the frontend tests/build passed afterward. This was not bypassed or hidden.

## Screenshots and manual verification

Screenshots under `docs/screenshots/mobile-employee-reference/` use isolated test data only:

- `overview.png`
- `targets.png`
- `activities.png`
- `kyc.png`
- `desktop.png`

Open Employee → Dashboard in the normal local LMS. Check the 2×2 cards, select a collection date, switch tabs, and open an actual installment's breakdown/history. Confirm unpaid installments offer only eligible collection actions. Open Customer KYC from the drawer and check the same centered mobile header, full-width Add button, tabs and authorized draft/revision actions.

No physical Android or iPhone was tested. On real devices, verify native date-picker behavior, keyboard visibility, touch scrolling, text scaling and orientation. Extra financial details and multiple-loan selectors can make a real-data view taller than the illustrative reference; no required information is removed to force a screenshot match. There are no known unresolved application errors from this change.
