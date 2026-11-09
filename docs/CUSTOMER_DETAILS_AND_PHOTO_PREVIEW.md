# Employee Customer Details and secure photo preview

## Implemented

The existing Employee Customer Details route now follows the supplied navy-and-gold reference: compact profile card, real risk/status display, desktop KYC/loan actions, mobile action row, four loan-summary cards, personal/contact/identity panels and a narrower timeline column. Information panels become native mobile accordions without unmounting their content. The existing logo, navigation and workflows remain.

Customer information is taken from existing authorized APIs. Missing fields show Not provided; unavailable summary data does not become a fabricated zero. Identity numbers are masked in the rendered page. Documents remain in the existing protected KYC viewer. Timeline entries come from existing CustomerTimeline records, and timestamps explicitly use Asia/Kolkata; no events are invented for empty history.

### Photo click behavior

- In this Employee profile, the photo and camera are separate buttons. Photo click opens the viewer; camera opens the existing uploader. Events stop propagation, so photo click does not trigger edit/navigation.
- Viewer requests existing authenticated photo metadata, then `/customers/:id/photo?variant=preview` as a blob. No public file URL or private storage path is exposed.
- The new preview variant uses the same ownership check, approved-KYC/display-photo source selection, encryption and no-store response headers. It rotates/sanitizes and resizes inside a bounded 1600×1600 box, preserving aspect ratio. Existing square thumbnail/profile variants are unchanged.
- The Employee header also uses aspect-preserving retrieval and contained rendering inside its circular frame.
- The modal has X, Escape and outside-backdrop close; native dialog focus handling; loading, retry/error and no-photo placeholder states; zoom in/out/reset controls; and pointer-based pinch/drag handling. Fit mode hides scrollbars; enlarged mode permits panning within the image stage. The surrounding page does not scroll horizontally.
- Requests are aborted and object URLs revoked when the viewer closes. Session/photo changes close it. Existing uploader validation, cropping, persistence and audit behavior are unchanged.
- Background collection refresh previously could replace the profile while loading, unmounting the viewer. The page now retains the loaded customer during refresh, never across a different customer ID, and hides it on authorization/read errors.

Existing display-photo uploads were historically stored as normalized square crops. Their saved crop is preserved; discarded original pixels cannot be reconstructed. Approved KYC photos use the actual retained image, with its original aspect ratio. No existing source or snapshot was overwritten.

## Read-only financial summary

The existing authorized `GET /customers/:id` response adds `financialSummary`:

- `loanCount`: actual customer loan count.
- `totalOutstanding`: sum of existing saved loan remaining balances, using integer-paise helpers.
- `overdueAmount`: sum of the existing shared `scheduleSummary` overdue values for open collectible loans.
- `overdueDays`: Asia/Kolkata day distance from the oldest currently unpaid overdue installment, including partially paid installments.
- `oldestUnpaidDue` and timezone metadata.

Customer ownership is checked before the summary is read. The projection returns no extra loan identities or documents. It does not change loan terms, schedules, receipts, allocations, settlements or customer records. The page refreshes through the existing collection-refresh mechanism; photo updates also refresh profile/timeline reads.

## Changed files

- `frontend/src/pages/employee/CustomerDetails.jsx`
- `frontend/src/pages/employee/customer-details.css` (new)
- `frontend/src/components/CustomerPhoto.jsx`
- `frontend/src/components/customer-photo.css`
- `frontend/src/components/CustomerPhotoPreview.jsx` (new)
- `frontend/src/components/customer-photo-preview.css` (new)
- `backend/src/controllers/customer.controller.js`
- `backend/src/services/customerOverview.service.js` (new)
- `backend/src/services/customerPhoto.service.js`
- `backend/tests/integration/customerPhoto.integration.test.js`
- `frontend/tests/customerPhoto.test.mjs`
- `frontend/tests/customerDetailsView.test.mjs` (new)
- This report and screenshots under `docs/screenshots/customer-details-ui`.

The legacy/default photo-editor behavior used by other pages remains unchanged; preview-on-click is enabled explicitly on this Employee details page. No schema migration or dependency installation was needed. Existing uncommitted changes were preserved.

## Executed verification

- **Backend: 39 suites / 351 tests passed**, coverage gates enabled; 235.859 seconds.
- **Frontend: 139 tests passed**, zero failures/skips.
- **Lint and production build passed** after the final fit-mode refinement.
- Verification logs/build/matrix: `tmp/customer-details-ui`.

New backend regression covers a non-square private image retaining 480×240 dimensions, no-store delivery, authentication/foreign-employee denial, zero-loan summary and a real isolated ₹800 partial/advance allocation. After that payment, the customer response correctly returned one loan, ₹20,200 outstanding, ₹1,300 overdue and two overdue days. Snapshot comparisons confirmed report/image reads did not mutate stored customer/KYC/financial records.

Frontend regressions cover distinct viewer/camera controls, existing KYC/loan routes, identity masking, real summary rendering, missing summary availability, inactive-customer issuance visibility and empty timeline messaging.

Browser checks used the existing disposable MongoMemoryReplSet fixture, not configured Atlas:

- Entered through My Customers and opened the existing Customer Details route.
- Photo click opened the actual stored approved test photo through a private blob; natural dimensions 360×460. Uploader was not opened accidentally.
- Zoom, reset, X, native Escape and a real backdrop click worked. The separate camera opened the existing uploader, which was canceled without saving.
- No-photo customer showed initials and a clear missing-photo message.
- **14 final geometry checks** across page and photo preview at **320, 375, 390, 430, 768, 1024 and 1440px**: no page/profile/modal overflow; four summary cards; modal within screen/height limits; original and rendered aspect ratios matched; the full image fit inside the stage at 100%.
- Mobile accordion toggles and desktop/mobile layouts were exercised.
- Issue Loan navigated to its existing form. KYC and Edit Profile opened the existing controlled KYC workflow. Risk Details opened the correct customer. No customer, KYC or loan forms were submitted.
- A hot-reload dependency-array warning occurred while adding an effect dependency during development. After a fresh reload, preview/zoom verification produced no new runtime errors.
- Desktop/mobile page and photo screenshots were saved and visually inspected. They contain synthetic fixture data only.

The normal backend was restarted and connected to its configured MongoDB. Unauthenticated photo-preview access returned 401; the normal frontend customer-list URL returned 200. Application remains at http://localhost:5173/employee/customers.

## Limits and manual checks

Custom pinch/drag handling is implemented, but physical Android/iPhone multi-touch gestures were **not** executed. Verify pinch, panning, keyboard behavior and camera/file picker on a real phone. Browser tests used actual stored test images and existing controls; no photo was uploaded or financial form submitted to the configured database. Existing upload persistence and KYC snapshot preservation were covered by the backend suite.

Manual steps: open a customer, tap the main photo to preview, try zoom/pan and X/outside/Escape close, then use the separate camera button. Check a customer without a photo. Confirm KYC/Edit/Issue Loan links, summary balances and timeline dates against your authorized test records. No configured data reset, repair or comprehensive before/after Atlas hash comparison was performed.
