# Loan Details tabs - functional fix

Completed 30 October 2026.

## Root cause

The previous shared Loan Details component mounted Financial Summary, Customer Information and Loan Timeline outside the selected-tab conditions. Other tab content appeared below that permanent Overview layout. Customer and Documents also contained navigation links instead of complete content. Tab clicks used history replacement, so browser Back/Forward did not follow tab selections.

The URL is now the selection source, with an explicit tab-to-component mapping. Only Overview mounts its summary/timeline layout. Tab clicks push history; invalid tab values normalize to Overview using replacement. Direct links, refresh, Back and Forward preserve the correct panel. Keyboard navigation and mobile active-tab visibility are supported. Background loan refresh retains the existing header/panel component instead of remounting the whole page.

## Content by tab

| Tab | Implemented content |
| --- | --- |
| Overview | Existing financial summary, authoritative outstanding, receipt/allocation totals, customer/employee summaries, repayment risk and real loan timeline. |
| Customer Details | Authorized personal/contact fields, three addresses, references, masked identity/bank numbers, vehicle details, KYC provenance and relationship links. Approved KYC data is selected ahead of unapproved revisions. Missing fields say Not provided. |
| Installments | Full loan-specific schedule; total/paid/partial/overdue/upcoming/remaining summaries; All/Today/Paid/Partial/Overdue/Upcoming filters; day/date search; desktop table and mobile cards; pagination; exact breakdown/receipt/history actions and existing sequential collection restrictions. |
| Payments & Receipts | Actual receipt-level amounts, received date, separate system entry timestamp, collector, customer review details, method totals, filtering, ordering, allocation breakdown, existing receipt view, direct PDF download and print action. |
| Documents | Six actual secure document categories, own-document thumbnails/metadata, image/PDF previews, downloads, supported PDF printing and approved KYC application preview/download/print. Missing documents remain missing; unapproved revisions are not substituted for approved files. |
| Collection History | Distinct receipt chronology with actual collection/allocation summaries, date/method/search/order filters, backdate reasons, exact receipt links, PDF actions and per-receipt allocation breakdown. No company settlement transfer records are mixed in. |

Receipt totals count valid positive receipt records once; allocations never become additional receipts. A synthetic ₹800 receipt remained ₹800 received, with ₹700 and ₹100 shown separately as installment allocations. Legacy records without allocation breakdown are identified as incomplete instead of inventing an unallocated balance. Existing payment/settlement verification and financial calculation rules were not changed.

The existing loan model has no separate loan agreement/attachment storage. The Documents panel says so rather than displaying invented files.

## APIs

Reused existing loan details/timeline, loan-scoped installments, collection history, receipt details, secure customer photos, authenticated KYC document retrieval and approved-snapshot PDF APIs. No public document/storage URLs were introduced.

Two read-only endpoints were added:

- `GET /api/v1/loans/:id/customer-profile`: JWT/role checks, loan ownership, current customer ownership and existing KYC access checks; returns selected approved profile/document metadata with masked account/identity numbers.
- `GET /api/v1/collections/receipt/:collectionId/pdf`: reuses existing receipt authorization and DTO, generates an A4 PDF with the existing logo/font assets and actual amounts/review/settlement values. Response is private/no-store. It performs no financial writes.

## Changed files

Frontend:

- `frontend/src/components/LoanDetailsView.jsx`
- `frontend/src/components/loans/LoanTabPanel.jsx` (new)
- `frontend/src/components/loans/LoanCustomer.jsx` (new)
- `frontend/src/components/loans/LoanPayments.jsx` (new)
- `frontend/src/components/loans/LoanDocuments.jsx` (new)
- `frontend/src/components/loans/LoanInstallments.jsx`
- `frontend/src/components/loans/LoanUi.jsx`
- `frontend/src/components/loans/loans.css`
- `frontend/src/utils/loanTabs.js` (new)
- `frontend/src/pages/admin/Loans.jsx` (customer-filter link support)
- `frontend/tests/loanTabs.test.mjs` (new)

Backend:

- `backend/src/services/loanProfile.service.js` (new)
- `backend/src/services/paymentReceiptPdf.service.js` (new)
- `backend/src/routes/loan.routes.js`
- `backend/src/routes/collection.routes.js`
- `backend/tests/integration/financialWorkflow.integration.test.js`

This report and screenshots in `docs/screenshots/loan-tabs/` were also added. Existing uncommitted work was preserved. No dependency, schema, calculation, configuration or KYC workflow changes were made.

## Executed verification

- **Frontend: 127 tests passed, 0 failed.** New coverage checks tab/component isolation, URL resolution, receipt totals, receipt/date filters, full-schedule statistics, approved-profile labels, exact customer routes, collection restrictions and document-type isolation.
- **Backend: 39 suites, 331 tests passed**, including configured coverage gates. Added checks cover approved-versus-draft isolation, masked identifiers, Employee/Admin access, foreign employee denial, protected receipt PDF export, A4 page dimensions and unchanged financial documents after reads/exports.
- **ESLint: PASS. Production build: PASS.** Build output is isolated in `tmp/loan-tabs/build`.
- **Browser: 60 settled layout checks passed** across all six tabs at widths 320, 360, 375, 390, 430, 480, 768, 1024, 1366 and 1920px, at 850px height. No horizontal page overflow, wrong panel, Overview leakage or clipped active tab was found in the final matrix.
- Browser tested actual tab switching, Back/Forward, refresh, invalid-tab fallback, partial schedule filtering, receipt download, exact receipt route, secure Income Proof PDF preview, approved six-page KYC preview, filtered-empty and no-document/no-payment states, and unavailable-loan retry feedback.
- Admin saw the same approved profile/receipt values, downloaded the same receipt, and the Customer Loan History action displayed only that customer's loan.
- A rendering defect found during testing was fixed: document cards now receive only the document for their own kind, so a photo cannot replace a different or missing document.
- The generated receipt PDF was rendered with Poppler and visually inspected. Text extraction confirmed ₹800 received and ₹700/₹100 allocations; the page was A4 with readable rupee glyphs and intact margins.

Browser testing used frontend 5187 and API 5017, explicitly connected to MongoMemoryReplSet database `loan_tabs_disposable`. All test accounts/documents/financial fixtures stayed in that disposable database. No sample data was written to Atlas.

## Configured-data integrity finding

The configured `loan_management` database changed during the task. Collection counts rose from **3 to 6** and cashbook counts from **3 to 4**; the two loan records and 90 schedules also changed hashes. Customer, KYC and employee-settlement collections in the comparison remained unchanged.

A separate read-only comparison confirmed that the **original three receipt records exactly match their baseline hash**. The normal backend log contains three successful collection POST requests, consistent with the new receipts and resulting balance changes. The aggregate comparison alone does not identify who submitted those requests. This task did not issue collection requests to the configured backend, reset records, repair balances or roll back the observed application activity. An unchanged overall database result is therefore not claimed.

## Running site and manual checks

The normal backend was restarted to load the new read-only routes; MongoDB connected and port 5000 is running. Both new endpoints returned 401 without authentication. The normal frontend on port 5173 returned 200.

1. Refresh your existing website once, then open Employee or Admin → My Loans/Loans → a loan.
2. Click every tab. Only Overview should show Financial Summary and Loan Timeline.
3. Refresh Customer Details/Installments and use browser Back/Forward.
4. Compare the approved profile and document version labels, receipt amounts, allocations and private download actions with your records.
5. Check the native Print/Save PDF dialog and physical printer margins on your device. PDF generation/rendering and the print pipeline were tested, but no physical print job or native print dialog verification is claimed.
6. Check scrolling/tab swiping on an actual Android/iPhone. Responsive browser emulation was used; real-phone testing is not claimed.

Screenshots for every tab are saved as `<tab>-desktop.png` and `<tab>-mobile.png` under `docs/screenshots/loan-tabs/`. They show only disposable synthetic fixtures.
