# Admin and Employee dashboard loading verification

The screenshot shows the shared React page error boundary. It does not contain the underlying exception/console stack. That original Chrome exception was not directly captured; the open Chrome windows available during investigation were on other pages. A cache conflict cannot be conclusively attributed to this specific screenshot from the image alone.

## Reliability defects fixed
- `frontend/tests/recovery.test.mjs` created a Vite server without a private cache directory, sharing the normal website configuration/cache. It now uses `node_modules/.vite-tests/recovery`, like the other SSR test suites.
- `frontend/vite.config.js` now defaults Node test processes to `node_modules/.vite-tests/default`. Explicit cache overrides are preserved. This guards future tests from touching the normal development server's dependency cache.
- All existing browser package dependencies used by lazy portal screens are prebundled, including Axios, Lucide, toast and the repayment gauge, alongside React, router, Recharts and PDF.js. This reduces late dependency discovery/rebuilds when switching routes.
- Existing error recovery and payment-history guidance remain intact. No automatic financial submission or automatic page reload was added.

## Regression tests
New: `frontend/tests/dashboardLoading.test.mjs`.
- Checks that a Node test runner receives a private default Vite cache.
- Serves actual Admin/Employee dashboard modules and dependency URLs through a cold local Vite server, runs a separate SSR recovery-component server, then checks that original dependency URLs still return 200 and live metadata remains identical.

## Executed results
- All **192 frontend tests passed**.
- Frontend lint passed.
- Production build passed.
- Captured the normal running website's six optimized dependency URLs and dependency-metadata hash before the full test/build run. Afterwards, metadata was unchanged and all six original URLs still returned HTTP 200. Both dashboard source modules returned HTTP 200.
- Browser: actual Admin and Employee login flows in a disposable database, dashboard rendering, fresh page reloads. Both headings rendered; neither showed `This page could not load`; both console error logs were empty.
- Screenshots: `docs/screenshots/dashboard-loading/admin-1366.jpg`, `employee-390.jpg` (synthetic data only).
- Before/after hashes of disposable financial collections matched; no payment submissions were made. No backend, financial logic or configured MongoDB records were modified.
- A separate experiment with two servers deliberately sharing a test cache did not reproduce an HTTP failure in that run. The missing isolation is corrected, but this report does not claim to have recovered the user's original browser stack trace.

The existing Chrome tab needs one Reload page / Ctrl+Shift+R to replace previously failed/cached modules. The normal frontend remains on port 5173. Browser checks used isolated API/frontend ports 5020/5190, not configured customer financial data.
