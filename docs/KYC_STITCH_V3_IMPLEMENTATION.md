# Stitch version 3 KYC PDF adaptation

## Inspection and design choices

Inspected all three HTML versions, inline CSS, image references, eight non-empty screenshots and the Sovereign Parchment design guide in the supplied ZIP. The version 2 screenshot is empty; its HTML remains available for comparison. The ZIP was safely extracted under `tmp/stitch-kyc` with traversal checks.

Version 3 supplies the primary visual structure: inset black masthead, original lion-and-crown emblem with a single company wordmark/tagline, gold-outline application title, gold subtitle ribbon, cream application ID/version/submission panel, dark brown/gold section ribbons, compact two-column fields and branded footers. Earlier versions informed readable document fitting and restrained spacing. The local original emblem is retained; external logo replacements, remote fonts, CDN scripts and example customer/document images are not imported.

The supplied HTML contains fictional verification stamps, officer signatures/IDs, compliance certificates, risk/bank figures and digital-signature/tamper claims. None are imported. Only recognized existing backend workflow states are displayed, explicitly labelled **Current KYC workflow**, separately from the selected application snapshot's provenance. An old snapshot is never relabelled as the current revision or as verified. The office signature area remains blank.

## Changed files

- `backend/src/services/kycApplicationPdf.service.js`: shared presentation for both portals and existing KYC PDF wrapper; removes the Document Details / Attachment Schedule summary entirely; preserves all eleven form sections, actual photo/signature and separate actual supporting-document pages. Identity/address image proofs have individual pages. Wide business/income images may share a page at readable scale. Source-PDF page rotations and aspect ratios remain supported. Truly blank uploaded PDF pages are identified with a clear note instead of fabricated artwork.
- `backend/tests/unit/kycApplicationPdf.test.js`: regressions for every section, unchanged input, allowed workflow status, omitted checklist/fabricated claims and blank source-PDF behavior, alongside existing long-text/image/rotation tests.
- `backend/tests/integration/kyc.integration.test.js`: strengthens both-portal download coverage by comparing customer-lead data and encrypted submission snapshots before/after exports.

Existing React preview, download and A4 print components already consume this shared PDF. They required no source changes. No new schemas, API contracts, production assets, loan calculations, customer/employee assignment rules or permissions were added. Configured MongoDB customer and financial records were not changed; automated records use disposable databases only.

## Executed verification

- Full backend: **43 suites, 382 tests passed**, coverage gates passed.
- Final KYC unit/integration run: **36 passed**. Admin/Employee downloads succeed; unauthenticated/unrelated employee access is rejected. The selected private attachment list and encrypted snapshots are unchanged after export.
- Frontend: **198 tests passed**, ESLint passed, production build passed.
- Synthetic sample: six A4 portrait pages rendered and visually inspected, including all eleven sections, photo, signature and identity/address/business/income previews. Text extraction confirms expected fields and absence of checklist and unsupported claims. Six pages are a result of these fixtures, not a fixed limit; PDFs and long fields extend automatically.
- Local backend restarted to activate the renderer; health endpoint checked.

Sample: `output/pdf/royal-kyc-stitch-v3-synthetic.pdf`; first-page preview: `output/pdf/royal-kyc-stitch-v3-preview.png`. Sample documents contain synthetic test data only.

## Manual verification

In either portal, open Customer KYC, choose Preview Form / View Complete Application Form, select the intended saved version and download again. Previously downloaded files retain their old design. Check real selected-version attachments, then open Print Form and choose A4. Existing A4 print-rendering tests passed; physical printing and real-phone browser printing were not executed in this task.
