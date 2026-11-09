Receiving-account HTTP 403 fix — 23 October 2026

Cause and request evidence

The failing request was POST /api/v1/settlements/accounts. The existing backend access log records three failures at 18:19:10, 18:19:16 and 18:20:09 UTC, all authenticated as EMPLOYEE. These correspond to 14:19:10, 14:19:16 and 14:20:09 America/New_York. GET /api/v1/settlements/accounts returned 200 because employees are allowed to list scoped accounts. Earlier Admin POSTs returned 201.

Both login pages previously wrote the same localStorage token/user keys. Axios read those keys for every request, but an open Admin layout did not subscribe to cross-tab storage changes. Signing into Employee in a second tab replaced the shared JWT while the first tab still displayed an Admin authorization form. The backend correctly denied the Employee token at its Admin-only POST guard. Account owner EMPLOYEE refers to the receiving-account owner; it does not mean an Employee caller is permitted to authorize it.

Fix

- Store token/user together in independent royal.session.admin and royal.session.employee entries. Preserve valid legacy sessions only in their matching portal. A fresh Admin login is needed if its old shared token was already overwritten.
- Axios chooses credentials using the current portal URL. Public login/recovery requests do not carry stored credentials. Role/identity consistency is checked locally; JWT signatures, active-account checks and role permissions remain enforced by the backend.
- Portal layouts subscribe to their own storage/session events. Logging out or receiving a 401 clears only the affected session. A late failure from an older request cannot sign out a newer login.
- Settlement idempotency scope uses the matching portal's user instead of the removed shared user key.
- Account POST/PATCH denials explain that account management requires an Admin session. Existing Admin-only permissions and Employee read scoping remain intact. No receiving-account, financial or KYC schema changes are needed.

Files changed

1. frontend/src/utils/portalSession.js — new session storage, migration and role/identity helpers.
2. frontend/src/hooks/usePortalSession.js — new session subscription hook.
3. frontend/src/services/api.js — portal-specific Axios authentication and scoped 401 handling.
4. frontend/src/pages/admin/Login.jsx — save only a successful Admin session.
5. frontend/src/pages/employee/Login.jsx — save only a successful Employee session.
6. frontend/src/layouts/AdminLayout.jsx — reactive Admin session and independent logout.
7. frontend/src/layouts/EmployeeLayout.jsx — reactive Employee session and independent logout.
8. frontend/src/pages/shared/DailySettlement.jsx — matching-user request-key scope.
9. frontend/tests/portalSession.test.mjs — session isolation, legacy matching, wrong-role data, Axios credential selection, failed login and stale 401 regression tests.
10. backend/src/routes/settlement.routes.js — useful Admin-session error for receiving-account mutations.
11. backend/tests/integration/receivingAccounts.integration.test.js — expanded permission, invalid employee, inactive employee/Admin, duplicate and digital source/verification tests.
12. docs/SETTLEMENT_ACCOUNT_403_FIX.md — this report.

Executed checks

- Full backend suite: 126 tests, 16 suites passed, including existing loan, collection, settlement and KYC tests. Uses disposable MongoDB only.
- Frontend Node tests: 11 passed. Frontend ESLint and production build passed.
- Isolated two-tab browser test: Admin opens an Employee UPI authorization form; Employee logs in in another tab; original Admin form submits successfully. Backend request log confirms POST 201 ADMIN and GET 200 for both scoped roles. Employee refresh shows the new active UPI account with zero available balance. Company accounts are absent from Employee source choices. Admin logout leaves Employee refresh working.
- API tests exercise COMPANY cash/UPI/bank, EMPLOYEE UPI/bank, invalid employee IDs, inactive employee/Admin, duplicate fingerprints (409), unauthorized Employee mutations (403), existing account listing, independent company UPI evidence approval and unchanged original collection documents.
- Browser Network-panel UI was not available through the automation interface. Request methods/statuses/roles were verified from backend access logs alongside browser actions. No raw Authorization header, full UPI/bank details or request bodies were captured in the saved evidence.

Local evidence is under ignored tmp/portal-session-fix: request-evidence.json (original failures, sanitized), browser-api-results.json (isolated success), backend-tests.log, frontend-build.log, and employee-source-after-admin-authorization.png. The preview runs on 5177/5007 against a temporary replica set, not the configured database.

Browser verification

1. Refresh both portal tabs to load the current frontend. Sign in again at http://localhost:5173/admin/login if redirected. Open Admin → Daily Reconciliation → Receiving accounts.
2. In a second tab sign in at http://localhost:5173/employee/login. Keep the Admin form open.
3. In Admin select Owner EMPLOYEE, the intended active employee, UPI and the verified account details. Authorize only if this is a new real authorization. Existing identical accounts are retained and return an already-registered message rather than creating duplicates.
4. DevTools → Network: GET /api/v1/settlements/accounts should return 200. The valid Admin POST should return 201; no token or UPI details need to be copied or shared.
5. In the chosen Employee tab open Daily Settlement → Refresh destinations → Employee digital funds → company. The authorized account should appear under Employee source account. Available balance can remain zero until actual classified collections exist; authorization does not create funds. Company destinations appear only under Company receiving account.
6. Admin can disable obsolete authorizations. Employees remain unable to authorize or modify receiving accounts. Existing settlements and historical transactions are retained.
