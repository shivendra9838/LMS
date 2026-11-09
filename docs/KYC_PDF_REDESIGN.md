# Customer Application / KYC PDF rendering

Completed 27 October 2026.

## What changed

Both existing PDF entry points now use the same renderer. The Customer Application preview/download and the older KYC bundle download retain their existing routes, authorization, audit events and approved/current-version selection.

- A4 portrait pages, white paper, black text, restrained gold headings, 12.7 mm margins, section borders and page numbers.
- Original company artwork contained in a 65 pt (22.9 mm) header area beside company name, tagline and application title.
- Actual selected-version customer photograph in the top-right photo box, preserving aspect ratio.
- Actual selected-version customer signature in its dedicated box, with a separate blank office verification/signature area.
- All existing configured personal, contact, address, reference, identity, bank, vehicle, loan and declaration fields retained, including Hindi text. Long values wrap and paginate without truncation.
- Ordinary sections stay together. Wide proof images are paired on labelled attachment pages to reduce wasted paper; portrait images and source PDF pages have sufficient space. All attachments use contained proportions, with no important edges cropped.
- Identity, address, business and income proof images are embedded, replacing metadata-only document rows. Uploaded multi-page PDFs are embedded as page artwork on labelled A4 sheets, respecting page rotation. Empty source PDF pages remain blank rather than being replaced with invented content.
- Missing documents/signatures say Not provided; missing selected attachment records get an explicit unavailable-attachments note. A corrupt or undecryptable attachment fails generation rather than substituting an unrelated image.

## Data and security

The renderer queries by both lead ID and the selected version's document IDs, decrypts bytes in memory and does not create public document URLs or include private storage paths. Source PDF scripts, actions and links are not copied into generated application pages. Existing ownership checks, authentication, no-store headers and download/view audit events remain in place.

No configured MongoDB data was read or written during this task's tests. No customer, approval, payment, loan, settlement, snapshot or audit-history migration was performed. Existing uncommitted work was preserved. Tests and browser fixtures used disposable local MongoDB replica sets with synthetic documents and identities only.

Submitted applications retain their original version and submission date through the existing immutable snapshot resolver. When no submission exists, its existing Current saved form / original submission snapshot unavailable label remains. The older explicit current-form export is labelled as current saved data rather than claiming it is a submitted snapshot. Approved exports retain the approved encrypted data and approved document IDs; an unrecorded approved version number or submission time is not invented.

## Files changed

- `backend/src/services/kycApplicationPdf.service.js`: shared layout, secure images and PDF attachment rendering.
- `backend/src/services/kycPdf.service.js`: compatibility adapter to shared generator.
- `backend/tests/unit/kycApplicationPdf.test.js`: pagination, six encrypted image categories, multi-page/rotated proofs, failed decryption.
- `backend/tests/integration/kyc.integration.test.js`: A4 checks, authorized uploads and same-version downloads for both portals; unauthorized access rejection.
- `backend/tests/integration/inbox.integration.test.js`: wait for AuditLog indexes before the rollback transaction test. The first full run exposed an existing background-index/transaction-lock race; no production notification code was changed.
- Six synthetic PNG fixtures under `backend/tests/fixtures/kyc-documents/`: photo, identity, address, business, income and signature.
- This report, screenshots under `docs/screenshots/kyc-pdf/`, and the synthetic review PDF under `output/pdf/`.

No frontend source, schema, dependency, API contract, encryption configuration or financial calculation was changed.

## Executed verification

| Check | Result |
| --- | --- |
| Backend full suite, including configured coverage checks | PASS: 224 tests, 29 suites |
| Coverage on configured collection | 95.23% statements, 93.49% branches, 94.73% functions, 98.22% lines; thresholds passed |
| Relevant final PDF/KYC rerun after pagination/document refinements | PASS: 32 tests |
| Frontend lint | PASS |
| All frontend tests, including A4 print pipeline | PASS: 33 tests |
| Frontend production build | PASS: `tmp/kyc-pdf-build` |
| Six-category authenticated upload and submitted-snapshot generation | PASS for Admin and owning Employee; public/unrelated Employee requests rejected |
| Admin/Employee PDF comparison | Identical extracted form text, same page count, same seven unique images: original logo plus all six selected document categories |
| A4 / rendered visual inspection | All five pages of the final full application inspected; every page of the multi-page/rotated proof variant also inspected |
| Employee browser workflow | Login, Preview Form, page navigation, PDF download succeeded |
| Admin browser workflow | Login, View Complete Application Form, five-page preview, secure six-document list, PDF download succeeded |
| Responsive preview | 320, 375, 390, 430, 768, 1366px; no page-level horizontal overflow at Fit width |
| Print pipeline | Automated rendering/decoding/page-break checks passed; browser Print Form controls invoked at mobile and desktop widths |
| Native printer dialog, physical A4 output, real Android printing | NOT VERIFIED: native print UI is not exposed by the browser automation tool |

An Admin download-event listener timed out after invoking native printing. The browser's direct download adapter subsequently saved the same authorized PDF successfully; it reopened as five A4 pages. Browser console inspection showed no application errors. The initial integration fixture reused an existing synthetic mobile number and correctly received HTTP 409; changing only the isolated fixture's number resolved the test.

Poppler reported optional Symbol/ArialUnicode display-font warnings; supplied application text uses embedded fonts and every rendered output page was inspected without missing text or image content.

## Browser acceptance steps

1. Restart the existing Node backend to load the updated renderer; the main application servers were not interrupted during isolated verification.
2. Employee → Customer KYC → open a completed application → Preview Form. Check the selected version, uploaded photograph, signature and proof pages.
3. Download PDF and use Print Form. Choose A4 and inspect all pages in your operating system's print preview. Repeat on Android Chrome, including Save as PDF if available.
4. Admin → Customer Approvals → open the same application → View Complete Application Form. Select the same revision, download and compare it with the Employee version.
5. Check View Uploaded Documents and any older submitted revisions. The existing approval/rejection controls should behave as before.
6. The Original KYC bundle menu remains available; its existing approved/current selection now uses the same improved renderer.

The four-page attachment mentioned in the request was not accessible in this turn. The existing code and bundled KYC template were inspected instead. The delivered sample contains only isolated test data and is not an export of a real customer.
