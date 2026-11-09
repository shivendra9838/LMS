# Separate Admin and Employee login portals — verification report

Royal Enterprises LMS · 6 November 2026

## Changes

Both public login pages now follow the supplied reference: original company artwork, distinct realistic office backgrounds, left introduction/right dark gold-bordered card on laptop/desktop, and a compact logo above a single-column card on mobile/tablet. Accessible email/password controls, show/hide password, Remember Me, loading/error states, Enter submission and gold Sign In actions are shared. Employee Reset remains available as a compact action. Portal-switching links were removed.

New server-bound login endpoints:

- POST /api/v1/auth/admin/login — queries Admin accounts only; issues ADMIN tokens only.
- POST /api/v1/auth/employee/login — queries Employee accounts only; issues EMPLOYEE tokens only.

The route chooses the role; body.role cannot change it. Wrong-portal credentials, inactive users, unknown accounts and incorrect passwords receive the same generic 401 response, without a token. Both collections may contain the same registered email without Admin lookup shadowing Employee login. Login responses are no-store. Shared failed-login rate limiting protects both portal endpoints and the legacy endpoint. Password validation errors hide submitted values.

The existing /api/v1/auth/login remains compatible with legitimate existing API clients. It derives its token role from the database, ignores body.role and now uses generic failure responses too. The website uses only the new portal-specific endpoints. Existing role/ownership restrictions on management and financial APIs remain intact; signed tokens with unsupported roles are rejected.

Remember Me uses the existing seven-day JWT lifetime unchanged: checked saves that portal session in localStorage; unchecked uses sessionStorage. Existing persisted/legacy valid sessions remain readable in their matching portal. Saving, clearing or failing one portal login does not clear the other portal's valid session. Expired claims are rejected by frontend guards in addition to server JWT validation.

## Password recovery and Gmail

Employee recovery stays under /auth/employee/otp/request and /otp/reset. Admin recovery now uses /auth/admin/otp/request and /otp/reset. The server-selected portal role is bound to both challenge creation and reset completion. Supplying a different role in the request cannot select another account class. An Admin OTP cannot reset through the Employee endpoint. Existing employee reset-link routes remain available. Expiry, five-attempt limits, persistent cooldown, hashing, transaction safety, audit entries and session revocation are retained. The frontend returns to the matching login after a completed reset.

Gmail configuration was preserved. A final local configuration check found it available and valid. The previously authorized single controlled non-financial email to the configured sender mailbox was executed successfully: SMTP_ACCEPTED, accepted=true. No recipient address, credentials or OTP was printed. Inbox/spam-folder receipt is NOT VERIFIED; a live production-account OTP reset was not performed. All automated recovery tests use mocked SMTP and isolated accounts.

## Startup issue found and fixed

An older LMS backend PID was still serving port 5000 after an attempted restart. Express 5 calls its listen callback with an error when the port is occupied, and the old startup callback printed success regardless. Startup now awaits successful binding before starting notification/email workers and cron; failed binding logs failure and disconnects MongoDB. Two regression tests cover success/failure and prevent duplicate workers on a failed bind.

Only the verified old LMS process was stopped. The tested backend replacement connected to the configured MongoDB; /api/v1/health returned 200. Both new login endpoints returned expected validation 400 for an empty request, confirming the live server loaded the new routes. The existing frontend returned HTTP 200 on port 5173.

## Verification

- Focused authentication/recovery/email suite: 45 tests passed.
- Final full backend run: 48 suites / 434 tests PASS, including both startup regressions and required coverage gates.
- Frontend: 207 tests passed.
- Frontend lint: PASS after correcting a test-file global reference reported by lint.
- Production build: PASS.
- Startup success and occupied-port regression tests: 2 passed.
- Browser: Employee and Admin successful sign-in/redirect; both wrong-role sign-ins rejected with a generic message; direct Admin dashboard URL from Employee-only session redirected to Admin Login; Enter, loading/disabled controls, Show Password, Employee Reset, Remember Me, refresh, Back/Forward, portal-specific Forgot Password and Admin OTP request UI tested.
- Employee logout + Back remained at Employee Login; the independent remembered Admin session still opened Admin Dashboard.
- Both login pages: 320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920 px. No document horizontal overflow. All nine width screenshots for both portals were visually reviewed in contact sheets; representative full mobile/laptop screenshots were inspected separately.
- Reduced-height viewport: 390 × 420 on both forms. Keyboard Tab focus scrolled Sign In fully into view. This is a browser viewport/focus test, not a real on-screen Android/iOS keyboard test.
- No unexpected browser runtime errors observed. Deliberate wrong-role requests return expected HTTP 401.

No configured-database users, credentials, roles or financial records were created, reset or edited by the verification. Synthetic accounts exist only in disposable MongoMemoryReplSet. No test loans or payments were created by the browser fixture; the ordinary backend financial test suite uses its own isolated databases. Existing uncommitted work was preserved. No dependency installation or SMTP secret change was required.

## Files

Created:
- frontend/src/components/PortalLogin.jsx
- frontend/src/assets/branding/royal-admin-office.webp (about 53 KB)
- frontend/src/assets/branding/royal-employee-office.webp (about 84 KB)
- frontend/tests/portalLogin.test.mjs
- backend/tests/integration/portalLogin.integration.test.js
- backend/tests/unit/serverStartup.test.js
- docs/LOGIN_PORTALS_REDESIGN.md

Updated:
- frontend/src/components/AuthShell.jsx
- frontend/src/components/auth-shell.css
- frontend/src/pages/admin/Login.jsx
- frontend/src/pages/employee/Login.jsx
- frontend/src/pages/employee/PasswordRecovery.jsx
- frontend/src/utils/portalSession.js
- frontend/src/services/api.js
- frontend/tests/portalSession.test.mjs
- backend/src/repositories/auth.repository.js
- backend/src/services/auth.service.js
- backend/src/controllers/auth.controller.js
- backend/src/routes/auth.routes.js
- backend/src/routes/passwordRecovery.routes.js
- backend/src/services/email.service.js
- backend/src/middlewares/auth.middleware.js
- backend/src/validators/auth.validator.js
- backend/src/server.js
- docs/EMAIL_NOTIFICATIONS.md (configuration/recovery addendum only)

Disposable QA fixture, image source copies, screenshots and logs are in tmp/login-redesign. Final PNG previews: tmp/login-redesign/final-employee-mobile.png, final-admin-mobile.png, final-employee-desktop.png and final-admin-desktop.png. All-width source captures and both responsive contact sheets are also retained. Some native screenshot captures have host-limited heights; requested widths were checked using the rendered DOM and final saved frame dimensions. No real-phone or Safari testing is claimed.

## Background assets and generation prompts

Built-in imagegen was used for background photography only. The existing logo was neither generated nor altered. Original generated PNGs were copied into tmp/login-redesign and converted to optimized WebP in frontend/src/assets/branding. The earlier financial background asset was preserved.

Employee background prompt:

> Create a photorealistic wide 16:9 background photograph for the Royal Enterprises employee loan collection login website. Real modern Indian finance office, dark charcoal office interior, walnut desktop along lower quarter, open unmarked notebook, elegant black pen and simple calculator in lower left to center. Subtle indoor plant and naturally sunlit window on right, gentle neutral gold light, realistic understated materials, sophisticated restrained atmosphere. Left upper half dark quiet negative space for an existing company logo and introduction. Right center also subdued enough for an HTML login card overlay. No text, no logos, no user interface, no people, no coin piles, no illustrated or artificial-looking elements. Full bleed background photograph, sharp realistic textures.

Admin background prompt:

> Create a photorealistic wide 16:9 background photograph for the Royal Enterprises administrator financial management login website. Premium understated executive office, dark charcoal wall, walnut desk along bottom, closed black leather planner and fountain pen at lower left, leather executive chair softly visible behind desk near center, warm floor lamp and subtle brass desk accessory at right, a small natural plant toward left edge. Restrained warm gold highlights, dark realistic materials, cinematic but natural professional lighting. Upper left quiet dark negative space for an existing company logo and introductory text. Right center subdued dark space for a real HTML login card overlay. No text, no logos, no interface, no people, no coins, no gaudy decorations. Wide full bleed realistic background photograph.

## Browser acceptance

Open the independent URLs:

- http://localhost:5173/employee/login
- http://localhost:5173/admin/login

1. Confirm the correct title/background and absence of portal-switch links.
2. Sign in with the matching account. Confirm the matching dashboard opens; try mismatched credentials and confirm the generic error.
3. Check Remember Me on a personal browser only; verify unchecked sessions close with that browser tab/session. Existing JWT expiry still applies.
4. Open Forgot Password from each portal and verify its matching return link. A real password change should be performed by the account owner.
5. Check Android Chrome and iPhone Safari with the real keyboard open, autofill, landscape, zoom/text-size settings and Back navigation.
6. Check the configured sender mailbox/spam folder for the one controlled Gmail test. SMTP acceptance does not itself prove inbox receipt.
