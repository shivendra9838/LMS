# Employee KYC Pending Approval — full-width responsive redesign

Completed 7 November 2026. Scope is only the Employee Pending Approval presentation and necessary page-scoped styles/artwork/tests.

## Changes

- Removed the black outer container and nested white card from PENDING only. The white page spans the full existing main content width, with no outer border/radius/card.
- Existing header is black (#030e13) at every tested width, using a selector active only while the Employee pending component is present. Main content is white; original logo assets, dimensions, header controls, profile dropdown, sidebar and navigation components were not changed.
- Centered pending clock, gold badge, heading, exact explanatory text and a small decorative document-review illustration.
- No suitable verification illustration existed in the assets directory. Added an original lightweight inline SVG of a document and reviewer at a laptop, entirely separate from the company logo. No external image, new package or generated/replaced logo was used.
- Actual customer name, saved KYC reference and latest submitted history timestamp remain sourced from the existing authorized record. Asia/Kolkata formatting is unchanged.
- Three-column details and side-by-side actions on desktop/laptop; stacked details/actions on mobile, with 46px touch targets and safe-area-aware bottom spacing.
- Approved/Rejected/Corrections Required screens retain their existing markup/design. Existing submission/loading/redirect, version checks, approval logic, read-only application/documents and real-time refresh remain unchanged.

## Files

- frontend/src/components/kyc/KycVerification.jsx
- frontend/src/components/kyc/KycReviewIllustration.jsx (new)
- frontend/src/components/kyc/kyc-verification.css
- frontend/tests/kycVerification.test.mjs
- docs/EMPLOYEE_KYC_PENDING_REDESIGN.md

No backend/API, CustomerKyc workflow, logo asset, document-storage, permissions, customer/financial data or database reset changes were made. Existing uncommitted changes were preserved.

## Executed checks

- Full frontend suite: 237 passed, zero failures.
- Final focused KYC/editor/shared-loading tests: 19 passed after the last spacing adjustment.
- Final frontend lint: PASS.
- Final production build: PASS.
- Backend tests were not rerun for this UI-only change; no backend source was modified.
- Browser used the actual PortalShell, CustomerKyc and KycList with isolated synthetic Axios responses, never the configured database.
- Widths: 320, 375, 390, 430, 768, 1024, 1366, 1440, 1920. Every check confirmed a black header, white main background, full-width pending section, zero nested old cards, no horizontal overflow, and 46px action height.
- Laptop 1366×768: footer ended at approximately 678px, fitting in the viewport beneath the existing header.
- Mobile 320/390×844: normal scrolling puts both footer actions above the existing bottom navigation. At 390px the last action ended at 748px while the bottom navigation began at 787px.
- Mobile drawer opened from the left (x=0), had its existing close control and locked background scrolling; closed normally.
- Double-click submit generated one synthetic save and one submit POST. Existing progress appeared, then confirmed redirect and one Pending Approval list row/count.
- View opened the new pending page; refresh kept the status. View Submitted Application opened the original read-only form with the correct saved name, no save controls and no file-upload inputs. Browser Back restored verification. Back to KYC Records returned to the original list.
- Simulated Admin approval updated the actual refresh-hook response and restored the existing Approved card, without pending artwork or pending-only layout styles.
- Visually inspected desktop/laptop/mobile captures. Final browser console had no warnings or errors.

## Evidence

- tmp/kyc-pending-redesign/frontend-tests.log
- tmp/kyc-pending-redesign/focused-final-tests.log
- tmp/kyc-pending-redesign/lint-final.log
- tmp/kyc-pending-redesign/build-final.log
- tmp/kyc-pending-redesign/final-responsive.json
- tmp/kyc-pending-redesign/laptop-1366.png
- tmp/kyc-pending-redesign/mobile-full-preview.png
- tmp/kyc-pending-redesign/mobile-footer-844.png

Screenshots are synthetic browser previews, not production customer records. Physical Android/iPhone/Safari testing and live KYC submission/approval were not performed. Please manually verify the real authorized test-account flow on a phone, including safe areas and native browser chrome.
