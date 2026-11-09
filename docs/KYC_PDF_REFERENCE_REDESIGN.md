# Customer KYC PDF reference redesign

Updated 5 November 2026. Both Admin and Employee use the existing shared `backend/src/services/kycApplicationPdf.service.js`; current/approved KYC exports also delegate to it through the existing wrapper.

The PDF now uses a full-width black-and-gold header with the original Royal Enterprises emblem, company name and tagline, application ID/version/submission strip, numbered gold section headings, compact bordered fields with vector icons, a customer photograph alongside Personal Information, and a branded page-numbered footer. Dates are formatted for reading without changing stored values. All existing form sections, actual private attachments, customer signature, blank office-verification area, snapshot provenance and document-page handling remain intact. Wide proof images share pages when readable; other images and PDF pages retain their aspect ratio.

Changed application file: `backend/src/services/kycApplicationPdf.service.js`.

Changed regression test: `backend/tests/unit/kycApplicationPdf.test.js`, extending existing A4 bounds coverage to a valid multiline personal field alongside the existing long-address case. Personal-photo height is bounded independently of long answers so pagination does not create a negative-height image box.

No API contract, authentication, database schema, customer data, submission snapshots, approvals, loan calculations, payment records or settlement records were changed. The configured database was not used to create test records. Existing read-only document selection and encrypted document retrieval are reused.

Executed verification:

- Full backend suite: 43 suites / 379 tests passed, including coverage gates.
- After final pagination changes: 34 targeted KYC unit/integration tests passed, including both authorized portal downloads, six encrypted attachment categories, saved versions, unauthorized access, source-PDF rotation and multiline pagination.
- Frontend: 198 tests passed; ESLint passed; production build passed. Frontend source files required no changes.
- Five-page synthetic A4 application rendered with Poppler; every page visually inspected. Test photographs, signatures and four document proofs display without distortion or clipped edges. An additional PDF generated through the authorized integration endpoint confirms Hindi text rendering.
- Local backend restarted and health endpoint checked to activate the renderer.

Review `output/pdf/royal-kyc-redesign-synthetic.pdf` for a synthetic-only design sample. Page count varies with real form content and attached documents. The supplied older customer PDF was inspected as a visual comparison and left unchanged.

To verify: open a Customer KYC in either portal, select the required application version, then Preview/Download PDF/Print. Download again to see the new rendering; previously saved PDFs retain their old design. Verify the selected version's photograph/signature and print preview on A4. Physical printing and real-phone printing were not executed.
