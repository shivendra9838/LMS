# Customer photos and clickable customer rows

## Changes

Employee My Customers and Admin customer portfolios reuse their existing details routes. Name, code and photo links, empty row/card clicks, and Enter/Space open that customer. View, Edit and Risk controls retain independent actions. The Admin employee-wise directory is preserved.

Shared private thumbnails use 42px circular avatars; details use 104px circles with a camera button. Missing or unreadable photos fall back to initials. The upload dialog supports JPG/JPEG, PNG and WebP, camera/file selection, circular preview, positioning, zoom, cancellation, upload progress and errors. Images load lazily and authenticated Blob URLs are revoked on cleanup.

New display photos are encrypted in a separate append-only `CustomerDisplayPhoto` collection. Each upload creates audit and customer timeline entries in the same transaction. Existing Customer fields, approved KYC documents, submission snapshots and financial records are not rewritten. Approved KYC PHOTO assets are reused until a separate display photo is saved. Safe embedded legacy raster images can be served privately; arbitrary legacy remote URLs are never fetched or rendered.

Backend checks active role and current customer assignment, file extension/MIME/magic bytes, complete raster decoding, 5MB size, 16 megapixels, non-animation and minimum 128px crop resolution. EXIF orientation is applied and metadata stripped. Encrypted originals never enter customer list responses. Protected image responses use private/no-store and nosniff headers. No public photo URLs or new encryption configuration were introduced. Sharp was added for image validation and processing.

## API

- GET `/api/v1/customers/:id/photo/meta`: availability/source/revision only.
- GET `/api/v1/customers/:id/photo?variant=thumb|profile`: authorized binary WebP.
- POST `/api/v1/customers/:id/photo`: multipart `photo`, normalized `x`, `y` and `zoom`; authenticated, assignment-checked and rate limited.

## Files changed for this task

Backend: `src/app.js`, `src/models/CustomerDisplayPhoto.js`, `src/routes/customerPhoto.routes.js`, `src/services/customerPhoto.service.js`, `src/services/customerPortfolio.service.js`, `tests/integration/customerPhoto.integration.test.js`, `package.json`, `package-lock.json`.

Frontend: `src/components/CustomerPhoto.jsx`, `src/components/customer-photo.css`, `src/utils/customerPhoto.js`, `src/components/CustomerTable.jsx`, `src/components/CustomerCard.jsx`, `src/pages/admin/CustomerPortfolio.jsx`, `src/pages/admin/CustomerDetails.jsx`, `src/pages/shared/CustomerRiskDirectory.jsx`, `tests/customerPhoto.test.mjs`.

Documentation: this report and synthetic browser screenshots in `docs/screenshots/customer-photo/`.

## Verification

Automated backend coverage includes assigned/foreign employee and Admin permissions, unauthenticated access, valid formats, encrypted storage, identical cross-portal bytes, approved KYC immutability, crop pixels, invalid/truncated/oversize images, reassignment, reconnection persistence, private headers and legacy-image security. Frontend tests cover navigation, independent controls, validation, cropping and shared integration.

Browser tests used an isolated in-memory replica set and synthetic customer portraits, never configured-database customer uploads. Verified name/photo/code/row clicks, Enter/Space, independent View/Edit/Risk actions, initials, KYC photo reuse, invalid selection, preview/crop/cancel/save, refresh, logout/login, full API process restart persistence, and Admin/Employee shared images. Before/after digests confirmed customer, KYC and financial records unchanged; two separate display-photo revisions were created in the disposable fixture.

Actual browser viewport widths: 320, 375, 390, 430, 768, 1024, 1366 and 1920px. Employee list/details, Admin portfolio/details and upload preview were checked without document horizontal overflow. Screenshots were visually inspected. Physical Android/iPhone camera permissions, native file pickers and virtual keyboards still require real-device checks.

Final results: backend **270 tests / 33 suites passed**, frontend **55 tests passed**, lint **passed**, production build **passed**. A legacy-photo field-selection regression found during the full run was fixed and the complete backend suite rerun successfully. A transient empty preview image source was also corrected before the final frontend checks.

Commands: backend `npm test -- --runInBand`; frontend `node --test tests/*.test.mjs`, `npm run lint`, and `npm run build -- --outDir ../tmp/customer-photo-final-build`. The alternate build directory preserves existing build artifacts. Local frontend 5173 and backend 5000 are running; the new photo API correctly returns 401 without authentication. Disposable browser test servers were stopped.

## Manual verification

1. Employee → My Customers: click a name, code, portrait or empty card/row; check View/Edit independently and use keyboard Enter/Space.
2. Customer Details → camera: choose a photo, position/zoom, cancel once, then save. Refresh and sign in again; confirm persistence and timeline entry.
3. Admin → Customers → employee portfolio or All Customers: open that customer and confirm the same image. The Admin camera editor uses the same protected API.
4. Confirm approved KYC photo/application snapshots remain original. A display-photo update is separate from KYC approval.
5. On a real phone, check Camera/file picker, sliders, save progress and bottom navigation. No financial records need to be created for these checks.
