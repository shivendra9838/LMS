# Customer Details KYC UI fix

Implemented 7 November 2026.

## Cause and changes

The shared customer details view combined light inherited canvas/theme variables with pale text. Scoped dark surfaces and readable local theme tokens now keep the profile, breadcrumbs, labels, actions and financial panels readable in both appearance modes without changing the global header, sidebar or logo.

The Employee page did not receive an explicit approved/current-review KYC presentation in its financial summary. The existing authorized customer read now adds read-only KYC status fields. Approved snapshots and pending revisions are displayed separately; account activation never implies KYC approval. The Employee page reuses the existing background refresh mechanism and keeps mounted data during refresh.

The shared overview shows a no-loans explanation only when the actual loan count is zero. Missing summaries are not represented as zero. Financial calculations and stored records are unchanged.

## Modified application and test files

- frontend/src/components/customers/customerDetailPresentation.js
- frontend/src/components/customers/CustomerProfileHeader.jsx
- frontend/src/components/customers/customer-profile.css
- frontend/src/components/customers/CustomerDetailSections.jsx
- frontend/src/pages/employee/CustomerDetails.jsx
- backend/src/services/customerOverview.service.js
- frontend/tests/customerDetailsView.test.mjs
- frontend/tests/customerProfileHeader.test.mjs
- backend/tests/integration/kyc.integration.test.js

## Executed verification

- Frontend lint: passed.
- Frontend production build: passed.
- Full frontend test suite: 247 passed, zero failed.
- Isolated KYC and customer-photo backend integration suites: 42 passed, zero failed (MongoMemoryReplSet, not the configured database).
- Browser UI fixture using the actual customer detail components and shared portal layout, with synthetic API responses and no database connection: Employee and Admin checked at 320, 375, 390, 430, 480, 768, 1024, 1366, 1440 and 1920px. No page/action horizontal overflow observed.
- Browser scenarios: approved customer with no loans; active/overdue loan; pending approval updated through the existing inbox refresh event; rejected/inactive customer without loan issuance or Admin-only actions. KYC remains independent of account status.
- Employee light appearance and Admin dark appearance retained readable customer content. Mobile final content remained above the fixed bottom navigation. Final browser console contained no errors.

Evidence: tmp/customer-details-fix-tests.log, tmp/customer-details-fix-backend.log, tmp/customer-details-fix-build.log and tmp/customer-details-fix/responsive.json. Screenshots are in tmp/customer-details-fix/.

## Limits and manual check

Browser verification used isolated synthetic responses, not a live approval in Atlas. No real Android/iPhone device testing was performed. Start/restart the normal backend to load the read-only response enrichment, open an existing approved customer in both portals, and confirm the verification badge, authorized actions and preserved real financial summary. A pending revision should retain the approved badge with a separate revision notice.
