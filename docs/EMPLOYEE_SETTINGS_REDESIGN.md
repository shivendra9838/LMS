# Employee Settings redesign

Implemented 4 November 2026 for /employee/settings from the supplied Settings reference. Existing uncommitted work was preserved.

## Delivered

- Route-scoped charcoal/black and gold appearance, original logo, existing sidebar/header/bell/account menu and mobile bottom navigation.
- Compact profile summary with authenticated circular photo, real name, employee code, status, phone, email and branch/location. Initials remain the fallback. Existing AccountContext refresh updates the header and mobile Settings avatar after saving/removing a photo.
- Desktop section navigation and content panel. Mobile opens on the profile and six full-width menu rows, with dedicated section content and an All settings return action. No full-page reload on section changes.
- Personal Information includes read-only name, email, phone, employee ID and status, plus the existing Admin-reviewed change-request workflow. City/area are protected; personal address uses the existing authorized edit endpoint.
- Work Information preserves read-only employment details and adds the existing updatedAt timestamp. The existing work summary remains available in a disclosure.
- Password, session logout, request status/cancellation, deactivation dependency checks, preferences and support remain available. Work shortcuts use the existing Customers, Loans, Collections, Settlement and Follow-ups routes.
- Change Photo supports existing JPEG/PNG, 2 MB and 16 megapixel validation, preview, Save and Discard. Remove Photo now requires confirmation. Private photo preview has Close, Zoom In/Out, Reset, Escape and backdrop dismissal with original aspect ratio.
- Take Photo opens a native camera-stream dialog on supported secure origins. It offers Capture, preview, Retake and Use Photo, followed by the normal Save Photo action. A device camera/file-picker fallback remains available while permission is pending or capture is unsupported. Camera errors have useful messages; tracks stop on close/capture and late streams are stopped after cancellation. No camera access occurs until the employee clicks Take Photo.

## Changed files

- frontend/src/components/EmployeeSettingsFrame.jsx
- frontend/src/components/employee-settings.css
- frontend/src/components/ProfilePhotoEditor.jsx
- frontend/src/components/ProfilePhotoDialogs.jsx (new)
- frontend/src/components/profile-photo-dialogs.css (new)
- frontend/src/utils/profileCamera.js (new)
- frontend/src/pages/shared/Settings.jsx
- frontend/src/layouts/PortalShell.jsx
- frontend/tests/employeeSettings.test.mjs

The shared photo editor also retains compatibility with the existing Admin profile. No backend route, model, authentication rule, encryption/storage mechanism or financial calculation changed. No database migration is needed.

## Executed checks

| Check | Result |
|---|---|
| Frontend ESLint | PASS |
| Frontend tests | PASS: 163 tests, 0 failures |
| Production build | PASS: tmp/employee-settings-ui/build |
| Full backend Jest suite, coverage gates enabled | PASS: 40 suites, 360 tests |
| Six sections at all 10 requested widths | PASS: 70 layout measurements, no page overflow or out-of-viewport controls |
| Photo preview/zoom/Escape | PASS in isolated browser |
| Remove confirmation, Cancel, confirmed removal to initials | PASS in isolated browser |
| JPEG/PNG validation | PASS automated; PNG chooser/preview/save exercised in browser |
| Saved photo after reload; shared header avatar | PASS in isolated browser |
| Authorized address edit | PASS in isolated browser |
| Preferences save/reload | PASS: date format persisted |
| Protected name change request | PASS: PENDING, original name remained read-only and unchanged |
| Password visibility and all-session confirmation | PASS in browser; confirmation cancelled |
| Password changes, invalid credentials, session invalidation and deactivation restrictions | PASS existing backend integration tests using isolated accounts |
| Five work shortcuts | PASS browser navigation to existing routes |
| Fresh Settings reload | PASS: 0 console errors |
| Sign out this device | PASS: returned to Employee login |
| Physical camera capture/retake and real-phone keyboard | NOT VERIFIED; no usable camera stream supplied by the test browser |

Widths: 320, 360, 375, 390, 430, 768, 1024, 1366, 1440 and 1920px. Browser testing used employee_settings_disposable on MongoMemoryReplSet, API 5017 and frontend 5187. The fixture had synthetic Admin/Employee/Branch/photo records and no customer, loan, payment or settlement records. Photo/address/preference/request changes were restricted to this disposable database. Configured MongoDB records were not read or mutated by this task.

Frontend regressions include read-only personal/work fields, real route shortcuts, image validation, aspect-preserving camera sizing, track cleanup/error mapping, preview controls and camera fallback/disabled capture before readiness. Backend tests cover existing ownership, secure uploads, current-password validation, Admin review, dependency restrictions and financial preservation.

Logs: tmp/employee-settings-frontend-tests.log, tmp/employee-settings-backend-tests.log, tmp/employee-settings-build.log. Browser measurements: tmp/employee-settings-ui/responsive-checks.json. Shortcut results: tmp/employee-settings-ui/navigation-checks.json.

## Screenshots and acceptance

Screenshots contain only isolated synthetic account data:
- docs/screenshots/employee-settings-ui/desktop-1440.jpg
- docs/screenshots/employee-settings-ui/mobile-390.jpg
- docs/screenshots/employee-settings-ui/personal-mobile-390.jpg

No known application failure remains in executed checks. The automation browser did not provide a usable hardware-camera stream, so capture/retake and actual camera permission denial were not browser-verified. Camera sizing, cleanup and error mapping passed unit tests. A camera requires HTTPS or localhost; on other origins the device-picker fallback remains available.

State, PIN, landmark and reporting-manager fields are not in the existing Employee schema and were not invented. English remains the only supported language; no unsupported landing-page or messaging preferences were added. Business timestamps remain Asia/Kolkata.

Manual acceptance: refresh the normal Employee Portal, open Settings, inspect the six sections and protected fields, preview the saved photo, and try Change Photo/Take Photo on an actual Android phone. Confirm permission allow/deny, capture/retake/save, Cancel before removing a photo, on-screen keyboard visibility and bottom navigation. A valid password change was not executed through the browser; its backend flow is covered by isolated integration tests. Authenticated acceptance against the configured database was not performed.

The temporary browser tab was closed, viewport override reset and disposable test servers shut down after verification. Normal LMS servers were left running.
