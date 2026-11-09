# Customer KYC form reference redesign

Implemented 29 October 2026 for the existing shared Employee/Admin KYC form.

## Changes

- Compact dark navy and gold form, responsive field grids, readable approval/review banners, and original portal branding.
- Desktop section navigation tracks the visible section and fits above the action bar. Mobile shows four sections plus More Sections and collapsible sections; values stay in the existing parent form state.
- Responsive Preview, Download, Print, and Original controls. Draft previews use the current saved version; submitted applications and approved snapshots retain their existing versioned endpoints. The original submitted-version viewer remains available.
- Six secure document cards reuse authenticated retrieval/upload, actual image previews, PDF preview, camera file input, replacement controls, progress, and validation.
- Human-readable history with actor names, IST timestamps, friendly field names, and Show More. Actor-name enrichment is read-only; original history is preserved.
- Save/submit actions use a synchronous in-flight guard. First-save navigation waits for an upload to finish. Unsaved routed navigation uses an accessible confirmation dialog and browser unload protection.
- Existing fields, approval/correction/revision rules, document encryption, PDF generator, and financial calculations are reused.

## Files changed for this task

- `frontend/src/pages/shared/CustomerKyc.jsx`
- `frontend/src/components/kyc/KycFormUi.jsx` (new)
- `frontend/src/components/kyc/kyc-form.css` (new)
- `frontend/src/hooks/useKycNavigationGuard.js` (new)
- `frontend/tests/kycFormUi.test.mjs` (new)
- `backend/src/services/kyc.service.js`
- `backend/tests/integration/kyc.integration.test.js`
- This report and synthetic-data screenshots in `docs/screenshots/kyc-form-redesign/`.

The workspace contains substantial pre-existing uncommitted changes; they were not reset or reverted.

## Executed verification

- Backend: 39 suites, 328 tests passed, including coverage gates and unauthorized KYC access/history regression coverage.
- Frontend: 114 tests passed. ESLint and production build passed. Build output isolated in `tmp/kyc-form/build`.
- Browser used a dedicated API on port 5015 connected explicitly to MongoMemoryReplSet database `kyc_form_disposable`, and frontend port 5185. Synthetic accounts/documents only.
- Browser: save draft, double-click save (one save event), section navigation retaining edits, file/photo replacement, actual protected image/PDF previews, document success feedback, readable history, submitted-version viewer, approved snapshot read-only view, PDF download action, and routed leave-warning/Stay behavior verified.
- Browser: submit locked editing; Admin requested corrections; Employee saw the reason, resubmitted; Admin approved/assigned; Employee had to request a revision before editing again.
- Incomplete draft submission showed field errors and remained Draft.
- Approved snapshot hash stayed unchanged through draft edits and document replacements, before an explicit synthetic Admin approval.
- Settled overflow/action-bar checks passed at widths 320, 360, 375, 390, 430, 480, 768, 1024, 1366, 1440 and 1920px (850px height). Desktop and mobile screenshots were visually inspected. This is browser viewport emulation, not physical-device testing.

## Record-integrity finding

Read-only comparisons of the configured `loan_management` database detected changes during the session: customer/customer-lead counts went from 1 to 2; KYC document counts from 6 to 12; submissions from 1 to 3; loans from 1 to 2; schedules from 30 to 90. Collection and employee-settlement counts/hashes remained unchanged; cashbook count remained 3 but its hash changed.

The test harness connects explicitly to an independent in-memory database. This task did not run configured-database mutation, deletion, migration, or repair scripts. The comparison cannot establish who changed these records. No attempt was made to undo them. Consequently, an unchanged configured-database result cannot be claimed.

## Remaining manual verification

- Check native Android/iOS camera capture and file-picker behavior; automation verified the camera-enabled input with a file selection.
- Check native Print / Save PDF preview and actual A4 margins on your browser/printer. PDF previews rendered; Print was invoked, but native print UI was not accessible to the test browser and is not claimed verified.
- Check physical browser Back and refresh/unload prompts with unsaved edits. Routed leave confirmation was browser-tested; native history restoration and cleanup are unit-tested.
- Restart the existing backend process when convenient to load the additive history actor-name DTO change. No configuration changes are required.

## Screenshots

- `screenshots/kyc-form-redesign/desktop.png`
- `screenshots/kyc-form-redesign/mobile.png`
- `screenshots/kyc-form-redesign/documents.png`
- `screenshots/kyc-form-redesign/history.png`
