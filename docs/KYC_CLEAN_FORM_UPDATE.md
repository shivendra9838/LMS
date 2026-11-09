# Clean KYC form content update

Updated the shared PDF renderer in `backend/src/services/kycApplicationPdf.service.js` and its regression checks in `backend/tests/unit/kycApplicationPdf.test.js`.

The original main header and logo drawing code were preserved exactly. Pixel comparison of the previous and updated rendered first-page header is identical. Only the content below it changed:

- All form labels and values use black; section title bars retain dark brown/gold backgrounds with white titles.
- Simple two-column tables retain every existing field, with full-width address/declaration rows and no icons or rules between individual labels and values.
- Personal Information retains the requested left-hand field order. The right-hand photo box contains only the selected uploaded photo with proportional fitting. Its heading, camera icon and caption are removed. Missing photos say Photo not provided without invented artwork.
- The current-workflow banner and prominent technical metadata panel are removed. Application ID/version/submission and snapshot provenance remain in small black metadata lines, preserving the distinction between submitted snapshots and a current saved form.
- Existing private attachments, signature, blank office-signature area, automatic document pages and numbered footer remain.

No database records, schemas, API permissions, approval/revision rules or financial logic were changed. Admin/Employee previews, downloads and printing use this same shared renderer through their existing components.

Executed checks:

- 36 relevant KYC unit/integration tests passed, including both portal downloads, unrelated-user denial, encrypted attachments, unchanged stored KYC/snapshots, A4 bounds, long text, black field labels, no workflow banner and no photo captions.
- 198 frontend tests passed, including the existing PDF print-rendering tests; ESLint and production build passed.
- Generated a six-page application using existing synthetic document fixtures. Every page visually inspected. Text extraction confirms all eleven sections, no workflow banner or photograph captions, and A4 portrait dimensions. First-page grayscale rendering inspected and readable.
- Original top-header drawing code and rendered header pixels compare unchanged.
- Local backend restarted and health endpoint checked.

Sample: `output/pdf/royal-kyc-clean-form-synthetic.pdf`; preview: `output/pdf/royal-kyc-clean-form-preview.png`. No synthetic records were created in the configured database. Physical printing and browser print dialogs were not exercised; automated print rendering was tested.

Download the form again from either portal to obtain the new rendering. Previously saved PDFs remain unchanged.
