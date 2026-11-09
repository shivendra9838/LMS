# Employee Collections & Outstanding Dues redesign

Implemented for `/employee/collections/today` using the supplied desktop/laptop/mobile reference. Existing shared navigation, authenticated photo access, payment dialog, allocation planner and financial refresh hook are reused.

## Behavior

- Five compact cards: unique assigned customers with active servicing loans, remaining date dues, unpaid previous overdue, their combined collectible balance and actual received-on-date payments.
- One table row/mobile card per customer **per loan**. Multiple loan balances/actions remain separate. Paid installments and prior advances reduce remaining dues through the existing server projection; shared receipts are counted once.
- All Customers, Due Today, Overdue and Paid Today filters with search-aware loan-row counts and server pagination. Total Customers counts unique customers. Due Today means remaining dues on the selected date; Paid Today means an actual receipt on that date, including partial/advance receipts. Portfolio cards remain independent of search filters.
- Search supports name, customer code, mobile and loan number. Date filtering uses Asia/Kolkata; the date picker permits today and earlier days. The payment modal receives the selected effective date and keeps existing backdate authorization/reason validation.
- Gold Collect amount opens the original modal. Existing server quotes prefill the actual overdue/date minimum. The Collections-specific lower-amount message is: Payment cannot be less than the total outstanding due of ₹X. Other portals' messages and backend minimum/advance policies are unchanged.
- Fully covered due balances show Paid and an exact View Receipt link when available. Actual receipt chronology selects the latest receipt; verification dates are not used as received dates.
- Three-dot desktop actions and expandable mobile headers expose View Loan, Installment Breakdown, Receipt History and Follow-up History. Detailed allocation/history dialogs are reused. Existing all-installment/upcoming advance-entry screens remain accessible under Installment schedules. Overdue deep links open the new Overdue tab.
- The page uses scoped black-and-gold tokens even if the account appearance is light. Responsive cards, wrapped text, touch controls and contained tablet table scrolling prevent page overflow.

## Changed files

- `backend/src/services/collectionRecovery.service.js`: additive `view=LOANS` read-only projection, filters/search/pagination; legacy response unchanged when view is absent.
- `backend/src/services/employeeDashboard.service.js`: internal-only option to supply its complete authorized customer summaries to the Collections read service. No new public financial-write API.
- `backend/tests/unit/collectionLoanView.test.js`: multi-loan separation, unique customer counts, shared receipts, search/pagination, chronological receipt selection and historical issue-date checks.
- `backend/tests/integration/dashboardFinance.integration.test.js`: new view authorization/counts/pagination/read-only checks, plus real isolated payment/read-refresh/idempotent retry coverage.
- `frontend/src/components/collections/RecoveryCollections.jsx` and new `employee-collections.css`: main responsive interface and detail presentation.
- `frontend/src/pages/employee/TodayCollections.jsx`: route existing Today/Overdue navigation into the new main interface; preserve detailed installment views.
- `frontend/src/components/collections/RecordPaymentModal.jsx`: optional initial effective date and page-specific minimum error text; same payment request, quote, confirmation and idempotency implementation.
- `frontend/tests/recovery.test.mjs`: compact cards, row grouping, hidden actions and fully paid receipt presentation.

## Executed checks

- Full backend run: **390 tests passed**, coverage gates passed. Final focused run after refinements: **32 tests passed**.
- Frontend: **202 tests passed**, ESLint passed, production build passed.
- Existing partial/advance/backdated allocation, authorization, receipt/settlement separation and idempotency integration checks remain passing. New payment/read-refresh test shows a real isolated ₹700 receipt clears due balances, appears in Paid Today and retains one record after a duplicate retry.
- Browser on disposable MongoMemoryReplSet: login, two loan rows from 60 schedules, Paid Today empty state, customer-code search, desktop menu, full installment breakdown, direct Collect, server preview and exact lower-amount message verified. No browser payment was submitted.
- Viewports: **320, 375, 390, 430, 768, 1366 and 1920px**. No horizontal page/card overflow after correcting the tablet grid's minimum width. At 320px the payment dialog fits from x=8 to x=312, with 765px height in an 850px viewport; internal scrolling and footer controls work. No application console errors observed.
- Disposable browser-test financial/source hash remains unchanged. No synthetic customers, payments or other financial records were written to configured Atlas. No reset/migration or historical repair was performed. Existing financial writes/calculations, KYC and settlement/reconciliation behavior are unchanged.
- Local backend restarted; health endpoint checked.

Screenshots: `screenshots/employee-collections/desktop-1366.jpg` and `screenshots/employee-collections/mobile-390.jpg`.

## Manual verification

Refresh Employee → Collections. Check cards, search and filters; open a customer's Collect action and confirm the effective date/minimum/allocation preview before an authorized payment. Verify the receipt and updated balances afterwards. Check the same workflow on a physical Android phone; real-device/Safari testing and configured-database payment submission were not performed in this task.
