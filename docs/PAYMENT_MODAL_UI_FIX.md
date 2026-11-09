# Record Payment modal UI fix

Root cause: the recovery page's generic input selector set checkbox width to 100% and minimum height to 44px. Inside the confirmation flex label, that consumed the row and squeezed the text into a narrow column. The existing modal also scrolled its entire container, allowing action buttons to disappear below long content.

Changed files:

- `frontend/src/components/collections/RecordPaymentModal.jsx`: separate header, scrollable body and persistent footer; explicit text spans for checkbox labels. Footer submit remains associated with the original form through a unique React-generated form ID. Existing handlers, validations, fields and actions are preserved.
- `frontend/src/components/collections/record-payment-modal.css` (new): component-scoped black/gold layout, 600px maximum width, 90vh/90dvh maximum height, vertical body scrolling, readable controls, 18px checkbox with flexible text, touch-sized footer buttons.
- `frontend/src/components/collections/recovery.css`: exclude checkboxes from the full-width input rule.

Verification executed:

- All **130 frontend tests passed**; lint and production build passed. Logs/build under `tmp/payment-modal`.
- Browser checks in a disposable MongoMemoryReplSet at **320, 375, 390, 768 and 1366px**, height 800px: dialog height 720px, no internal horizontal overflow, body scroll enabled, footer visible, checkbox width 18px and label width at least 240px.
- Additional 768×400 check: dialog height 360px, scrolling body and visible footer.
- Actual allocation preview fetched; confirmation enabled the submit button. Its `form` attribute matched the existing form ID. No payment was submitted.
- Invalid zero amount displayed the existing validation and disabled Submit. UPI selection exposed the required receiving-account/reference fields. Checkbox-to-Cancel keyboard navigation, internal scroll and Cancel close were verified. No console errors were observed.
- Mobile and desktop screenshots in `docs/screenshots/payment-modal` contain only synthetic records.

No backend code, financial calculations or configured MongoDB records were changed. Backend tests were not rerun for this frontend-only change. Physical-phone/virtual-keyboard testing remains manual.
