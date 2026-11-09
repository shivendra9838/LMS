# Phase 1: Customer KYC integration

## Implemented workflow

The existing customer request (`CustomerLead`) is the canonical KYC record. The existing employee customer entry route opens the shared KYC form. The existing Admin Customer Requests page includes KYC submissions and links to the full review screen. Existing legacy customer forms and requests remain supported.

States: `DRAFT -> PENDING -> APPROVED / REJECTED / CORRECTION_REQUIRED`. Employees can edit drafts, rejected records, or records returned for corrections. Approved records require an explicit revision; the existing approved customer profile, documents, and snapshot remain unchanged while that revision is reviewed. Admin approval updates the linked customer and snapshot in the same MongoDB transaction. Loan calculations, schedules, and existing loan employee assignments are not changed.

All fields in the supplied two-page Customer KYC reference are represented, plus the existing LMS father-name and area fields. Business and vehicle fields are optional; required fields are marked in the interface. Loan amount and tenure are application information only and do not create or modify a loan. Customer declaration requires confirmation, a typed name, a declaration date, and a signature image. This is a recorded handwritten signature, not a cryptographic signing service.

## UI routes

- Employee: `/employee/customers/add`, `/employee/customers/kyc`, `/employee/customers/kyc/:id`, `/employee/customers/:customerId/kyc`.
- Admin: existing `/admin/customers/requests`, plus `/admin/customers/kyc/:id` and `/admin/customers/:customerId/kyc`.
- Existing customers without KYC can start a linked draft from their customer detail screen. Their profile is preserved until review.
- KYC lists support name/mobile search and status filters. Existing customer filters remain available.
- Save before downloading/printing. PDF downloads use the original reference as the first two pages, followed by the full record transcript and uploaded documents. The transcript retains long values that exceed the original blanks. Bundled OFL Noto font supports Latin and Devanagari text.
- PDF documents preview inside the interface using a locally served PDF.js worker, with page navigation. Printing renders the complete PDF into printable pages in a new window, avoiding a dependency on a browser PDF plugin. The user must allow the print window and complete their browser/system print dialog.

## Database additions (no destructive migration)

`CustomerLead`: additive KYC schema version, encrypted current payload, encrypted approved payload, document references, approved document references, approval timestamp, and edit-history metadata. Drafts permit incomplete legacy-required fields, while submission validation enforces completion. Optimistic concurrency uses Mongoose `__v`.

`Customer`: additive `kycLeadId` and `kycApprovedAt`. KYC approval mirrors normal customer profile fields and a masked identity number for compatibility. Full identity and bank details remain in the encrypted KYC payload. Direct profile edits are blocked for linked KYC records; operational active/inactive status remains available.

New `KycDocument` collection: encrypted document bytes, owning request, category, verified MIME type, byte size, SHA-256 digest, uploader, and timestamps. File names and storage paths are not exposed or retained. Replacements preserve the previously approved file until a new approval.

New partial unique indexes prevent duplicate pending KYC mobile numbers and duplicate mobile numbers among KYC-linked customers, without indexing legacy customers into a new uniqueness constraint. Normal Mongoose index creation applies these indexes. Existing records are not deleted, reseeded, or migrated. Historical legacy plaintext identity fields are not automatically rewritten by this phase.

## API endpoints

All routes below use the existing bearer JWT authentication and role checks. Base prefix: `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/kyc` | Employee creates draft: `{ data, customerId? }` |
| GET | `/kyc/:id` | Authorized complete record, approved snapshot, document metadata, and history |
| GET | `/kyc/customer/:customerId` | Resolve the same KYC through a linked customer; null if absent |
| PUT | `/kyc/:id` | Employee saves editable draft: `{ data, version }` |
| POST | `/kyc/:id/submit` | Employee submits: `{ version }` |
| POST | `/kyc/:id/revise` | Employee starts approved-record revision: `{ version }` |
| POST | `/kyc/:id/documents` | Multipart: `file`, `kind`, `version` |
| GET | `/kyc/:id/documents/:documentId` | Authenticated document bytes, no public URL |
| GET | `/kyc/:id/pdf` | Complete current KYC PDF |
| GET | `/kyc/:id/pdf?snapshot=approved` | Complete last approved KYC PDF |
| GET | `/customer-leads` | Existing list; supports `search`, `kycOnly=true`, new statuses, pagination |
| POST | `/customer-leads/:id/approve` | Existing approval; KYC requires `{ employeeId, version, adminRemarks? }` |
| POST | `/customer-leads/:id/reject` | Existing rejection; reason required, KYC also requires version |
| POST | `/customer-leads/:id/corrections` | Admin returns pending KYC: `{ version, adminRemarks }` |

The version is returned in the KYC DTO. Stale writes return HTTP 409 rather than overwriting another session. Validation returns HTTP 422 with `{ path, msg }` field errors. Existing express-validator routes retain HTTP 400 validation responses.

## Security and deployment

- AES-256-GCM encrypts the complete KYC payload and each document with fresh random nonces. Encryption fails closed when `KYC_ENCRYPTION_KEY` is missing/invalid. A local persistent random key was added to the ignored backend `.env`; no key is committed. Deployment needs its own persistent 32-byte hex key. Back up and protect it; changing it requires a controlled re-encryption migration.
- MongoDB must support transactions (replica set or Atlas), as existing payment processing already requires. This implementation does not switch or reset the application's configured database.
- New sensitive responses use `Cache-Control: no-store`. Sensitive payloads/bytes are excluded from normal Mongoose selections, list DTOs, audit values, and public static routes.
- Employees must be active and own the request or currently assigned customer. Reassignment revokes the prior employee's KYC access. Admin accounts are checked for active status on KYC access. Legacy routes cannot mass-assign KYC workflow fields.
- Uploads authorize before multipart parsing. Limit: one file at a time, 2 MB/file, 30 files and 12 MB total per request including historical replacements. JPEG/PNG/PDF signatures and parsability are checked. Photos/signatures require images; images have a 20 megapixel limit. PDFs have a 20-page limit; encrypted PDFs, script/actions, and embedded file objects are rejected. No antivirus service is integrated.
- Required upload categories: `PHOTO`, `IDENTITY`, `ADDRESS`, `SIGNATURE`; optional `BUSINESS`, `INCOME`.
- History exposes actor/time/action/changed field names/review reasons, not historical raw field values. Audit events cover edits, uploads, reads, downloads, and reviews. Mutation audit writes are transactional.
- Frontend supports `VITE_API_URL`; its default remains the existing localhost API address. No KYC values are stored in browser localStorage.
- HTTPS, production key management/backups, retention policies, and production database access configuration remain deployment responsibilities.

## Verification commands

```powershell
cd frontend
npm run lint
npm run build
cd ../backend
npm run test:unit -- --runInBand
npm run test:integration -- --runInBand
npm test -- --runInBand
```

Integration tests start an isolated MongoDB replica set using mongodb-memory-server. They do not connect to MONGODB_URI or modify application data. First setup needs its MongoDB binary download. Tests cover authentication/ownership, drafts, stale writes, validation, upload limits and malicious content, encryption, previews/PDFs, approval/corrections/rejection, snapshots, reassignment, audit history, existing-customer linking, and existing loan/collection/receipt/cash-book behavior.

For isolated browser QA: run `node scripts/kyc-preview.js` in backend; start frontend with `VITE_API_URL=http://127.0.0.1:5101/api/v1`. This preview creates only a temporary replica set and synthetic accounts `employee@kyc.test` / `admin@kyc.test`, password `PreviewOnly123!`, and never reads the application's database connection. Stop it after testing.

## Files introduced or changed for this phase

Backend additions: `assets/Customer_KYC_Form.pdf`, `assets/fonts/NotoSansDevanagari.ttf`, `assets/fonts/OFL.txt`, `.env.kyc.example`, `scripts/kyc-preview.js`, `src/config/kycFields.json`, `src/models/KycDocument.js`, `src/routes/kyc.routes.js`, `src/services/kyc.service.js`, `src/services/kycPdf.service.js`, `src/utils/kycCrypto.js`, `src/validators/kyc.validator.js`, `tests/unit/kyc.test.js`, `tests/unit/customerWorkflowValidation.test.js`, and `tests/integration/kyc.integration.test.js`.

Backend extensions: `src/app.js`, `src/models/Customer.js`, existing uncommitted customer-lead model/routes/controller/repository/service/validator, `src/services/customer.service.js`, `tests/integration/api.integration.test.js` (required employee-allocation fixture), `package.json`, `package-lock.json`, and ignored local `.env` (encryption key only).

Frontend additions: `eslint.config.js`, `src/pages/shared/CustomerKyc.jsx`, `src/pages/employee/KycList.jsx`, `src/components/KycPdfPreview.jsx`.

Frontend extensions: `src/App.jsx`, `src/pages/employee/AddCustomer.jsx`, `src/pages/employee/EditCustomer.jsx`, both customer detail pages, `src/pages/employee/CustomerList.jsx`, existing uncommitted `src/pages/admin/CustomerLeads.jsx`, `src/components/CustomerTable.jsx`, both layouts, `src/services/api.js`, `package.json`, and `package-lock.json`.

Root: `.gitignore` excludes generated QA files under `/tmp/`; this document records the integration. Previously uncommitted changes and tracked `frontend/dist` changes were preserved; verification builds were written outside that folder.

## Executed results (October 23, 2026)

- Frontend `npm run lint`: passed.
- Frontend production build: passed; main chunk remains above the existing 500 kB warning threshold. PDF.js is lazy-loaded in its own chunk with a separate worker asset.
- Backend unit command: 27 tests passed across 7 suites, including the unchanged 80% coverage gate.
- Backend integration command: the original run passed all functional assertions but initially missed its branch-coverage gate; additional invalid-data regression cases resolved it. Two additional permission/mass-assignment cases were then added.
- Final combined `npm test -- --runInBand`: 56 tests passed across 9 suites (27 unit and 29 integration); configured coverage thresholds passed. These coverage thresholds cover the repository's configured helpers, middleware, and validators, not every application service.
- Database-backed tests verified the complete draft/submission/review lifecycle, encrypted uploads and PDF downloads, old/new API authorization, stale writes, approved snapshot isolation, reassignment, audit metadata, linking an existing customer, and unchanged loan/partial/extra collection/receipt/cash-book behavior.
- Browser QA against a temporary MongoDB replica set verified employee login, KYC navigation, saving/reloading a draft, missing-field validation, submitted-record rendering, photo preview, and PDF document preview with pagination. A blank plugin-dependent PDF preview was found and replaced with PDF.js; the corrected preview was visually verified.
- Generated reference-based PDFs were reopened, text-checked (including Devanagari), rendered, and visually inspected. All test identities and uploaded document fixtures are synthetic.
- Dependency advisory checks: frontend has 0 reported advisories after compatible fixes. Backend has 5 remaining advisories: 3 high in the nodemon/chokidar/braces development dependency chain and 2 moderate in ExcelJS/uuid. The registry's proposed automatic fixes require breaking downgrades, so those were not forced. The newly added upload/PDF libraries are not in the remaining advisory list.
- `git diff --check`: passed.

## Remaining verification and limitations

The configured application/production database was not used for tests. Verify transaction-capable MongoDB connectivity and the persistent encryption key in the deployment environment, then restart the backend. Verify the real browser print dialog/printer, real scanner/photo files, any scripts beyond the bundled Latin/Devanagari font coverage, and desktop/mobile appearance on target devices. No malware scanning service, external identity verification service, cryptographic signature provider, or automatic legacy-data encryption migration is included. Historical KYC history lists metadata and changed field names; it does not expose every previous field value.

Manual browser acceptance: create and save a draft, reload/edit, upload a photo/identity/address/signature, submit, review from Admin Customer Approvals, request corrections with a reason, resubmit, approve/assign, and confirm both portals resolve the same record. Start an approved-record revision and confirm the customer profile changes only after another approval. Check PDF download and printing, and verify a different employee cannot open the KYC/document URLs.
