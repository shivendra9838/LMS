# KYC verification, approval and signed PDF

## Implemented workflow
Employee opens Customer KYC, completes existing fields/documents/customer declaration/signature, then adds their own Employee Verification signature by drawing or image upload. Explicit verification consent is required. Submit saves the form, uploads encrypted verification evidence, submits the exact saved revision, shows existing processing UI and redirects to Pending Approval records. An upload or API error leaves the local signature and form available to retry.

Admin opens Customer Approvals -> KYC -> Customer KYC Form, reviews the application, supplies their own Office Verification / Authorized Signature, chooses an active employee, and explicitly confirms signature/approval/assignment before Approve & Assign. Corrections and rejection require the existing reason but no signature. Existing legacy referrals retain their separate flow.

Both portal PDF routes share the existing renderer. The original company header/logo, customer fields, declaration, document previews and customer signature remain. Employee identity/code/signature/time, Admin identity/role/signature/time, approved revision, KYC reference, approval ID and assigned employee are included. The complete approved PDF bytes are encrypted and hashed when approval commits. Downloads return that immutable PDF; a new revision cannot overwrite it. A submitted revision without signed approval never receives an Admin signature. Older approvals/signatures are not fabricated or backfilled.

These are authenticated electronic signature images with revision-bound audit evidence, not certificate-based cryptographic signatures or an eSign/DSC provider integration.

## Security and persistence
- New append-only KycVerificationSignature model: authenticated signer ID, role, captured display name/code, revision number, content binding, digest, signed time and encrypted image bytes. No public image URLs.
- New KycApproval model: unique submission reference, Admin signature reference, assigned employee identity, approval time, immutable encrypted finalized PDF and SHA-256 digest.
- Additive CustomerLead employeeVerificationId / kycApprovalId references and KycSubmission employeeVerificationId. No migration or historical record changes required.
- Server derives identity; client names/roles/timestamps cannot impersonate signers.
- Signatures must match actor, role, KYC ID, version and exact data/document binding. Fresh revisions require fresh verification.
- JPEG/PNG/WebP image decoding, 2 MB / 16-megapixel limits, blank-image rejection and private encrypted storage. Signature storage and audit commit together.
- Existing JWT, active-account/ownership checks, optimistic concurrency, transaction-protected customer updates and permission checks remain. Approval uniqueness prevents concurrent duplicate approval.
- Existing production data was not seeded, reset, approved or otherwise changed by tests. Integration tests use MongoMemoryReplSet with lms_phase1_isolated_test.

## API changes
- POST /api/v1/kyc/:id/verification-signatures — authenticated multipart file + version; employee editable KYC / Admin pending KYC only.
- GET /api/v1/kyc/:id/verification-signatures/:signatureId — private audited image access; unattached evidence visible only to its signer; attached evidence subject to KYC ownership.
- POST /api/v1/kyc/:id/submit additionally requires signatureId and confirmed:true.
- POST /api/v1/customer-leads/:id/approve additionally requires signatureId and confirmed:true for KYC applications; employee assignment and version remain required.
- Existing application/pdf and pdf routes return the same preserved final signed document when available. Versioned application URLs retain historical outputs.

## Changed source and test files
Backend:
- backend/src/models/CustomerLead.js
- backend/src/models/KycSubmission.js
- backend/src/models/KycVerificationSignature.js (new)
- backend/src/models/KycApproval.js (new)
- backend/src/services/kyc.service.js
- backend/src/services/kycSignature.service.js (new)
- backend/src/services/kycApplication.service.js
- backend/src/services/kycApplicationPdf.service.js
- backend/src/routes/kyc.routes.js
- backend/tests/integration/kyc.integration.test.js
Frontend:
- frontend/src/pages/shared/CustomerKyc.jsx
- frontend/src/components/kyc/KycFormUi.jsx
- frontend/src/components/kyc/KycSignature.jsx (new)
- frontend/src/components/kyc/kyc-signature.css (new)
- frontend/src/utils/signaturePad.js (new)
- frontend/tests/kycSignature.test.mjs (new)

## Verification
- Full backend: 49 suites / 459 tests passed; coverage thresholds passed (93.67% branches).
- Final targeted backend KYC + PDF: 37 tests passed, including rejection/corrections without signatures, explicit consent, stale revision, invalid image, wrong employee, another Admin signature, unauthorized access, concurrent approval, preserved original PDF, reassignment permissions and identical Admin/Employee PDF bytes.
- Final frontend full suite: 244 tests passed. Lint and production build passed. Results recorded in tmp/kyc-signatures-frontend-final.log and tmp/kyc-signatures-build.log. Six focused signature tests cover mouse/touch/pen coordinate scaling, pointer release, busy/empty input, delayed encode disposal, Clear races and multi-pointer interference.
- Browser UI checks used actual CustomerKyc / PortalShell with a synthetic Axios adapter, not the configured database. Upload/preview/consent, required-signature errors, submission/loading/redirect, Admin selection/approval and removal of approved review controls passed. No console errors.
- Employee and Admin viewport checks: 320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920 px. No document/signature overflow; canvas display and bitmap aspect ratios match, touch-action is scoped to the drawing area.
- Rendered and visually inspected all five pages of an isolated signed A4 application using Poppler. Signature blocks, approval metadata, documents and footer fit printable bounds. Source images are explicitly synthetic test fixtures.
- Local backend and React frontend started with existing configuration; backend health success and frontend HTTP 200 checked. No credentials read or printed.

## Manual acceptance
1. Refresh the existing Employee Portal. Open Customer KYC -> editable application; complete all existing required fields and customer documents/signature.
2. In Employee Verification, draw your own signature (or Upload Signature / Camera), Preview, then tick verification confirmation and Submit for Admin Approval.
3. Confirm redirect to KYC records and Pending Approval. Employee has no approval or Admin-signature action.
4. Admin -> Customer Approvals -> application KYC; review all data, sign Office Verification, choose active assigned employee, tick explicit approval confirmation, Approve & Assign.
5. Download/preview/print from Admin and assigned Employee. Verify all three distinct signatures, names, dates, approval record and assigned employee. For a revision, use submitted-application history to view the preserved old approved PDF.
6. Separately verify correction/rejection reason flows and fresh verification after edits, using your own authorized test applications.
7. Check finger/stylus drawing, camera/gallery, PDF download and printing on real Android Chrome and iPhone Safari. These real-device and physical-print checks were not executed here. Automated pointer tests and responsive IAB checks are not claimed as real-phone testing.

Evidence: tmp/kyc-signatures/ contains synthetic browser fixture, responsive measurements, screenshots, signed-application.pdf and all five rendered pages. Logo assets, navigation, unrelated pages, loan/payment/settlement calculations and existing records were not modified.
