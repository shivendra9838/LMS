# Receipt PDF preview loading fix

## Confirmed cause
The running local Vite server returned HTTP 504 `Outdated Optimize Dep` for the PDF.js module URL emitted by `src/components/KycPdfPreview.jsx`. This failed before the PDF viewer could load the receipt. It was a frontend dependency-cache failure, not a missing customer payment.

## Changes
- `frontend/vite.config.js`: prebundle `pdfjs-dist` alongside existing lazy dashboard dependencies so opening the receipt does not discover and invalidate the PDF dependency late.
- `frontend/src/components/KycPdfPreview.jsx`: add readable preview error and Retry PDF preview action; ensure PDF print loading tasks are destroyed even when document parsing fails.
- `frontend/tests/pdfViewerLoader.test.mjs`: cold local Vite server regression verifies prebundling and HTTP 200 for the transformed PDF module and worker.

Restarted the verified normal Vite process using `--force` to rebuild only its dependency cache. Normal frontend now PID 14216, port 5173. No backend code, payment records, loan balances or MongoDB data were changed.

## Executed verification
- Reproduced original PDF module request: 504 before fix, 200 after restart.
- All 187 frontend tests passed.
- Frontend lint and production build passed.
- Final targeted PDF loader/print pipeline rerun: 4 tests passed.
- Browser test of the real shared viewer with a synthetic, two-page PDF: successful rendering, page navigation, zoom, 390px mobile fit.
- Forced a test PDF-loading failure; readable error and Retry button appeared. Removed the simulated failure and clicked Retry: both PDF pages rendered successfully.
- Browser download event was not reported by the in-app browser within 5 seconds; browser file-save completion is not claimed. PDF HTTP delivery and module/worker loading were verified; existing receipt download code was unchanged.
- Printing pipeline unit tests passed; native printer dialog/physical printing was not verified in this fix.
- The user's authenticated Chrome receipt was not directly inspected; refresh that receipt page once to load the rebuilt dependency module.

Screenshot: `docs/screenshots/pdf-render-fix/mobile-preview.jpg` (synthetic document; no customer data).
