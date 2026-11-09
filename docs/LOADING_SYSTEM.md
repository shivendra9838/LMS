# Royal Enterprises shared loading system

Implemented 7 November 2026. This change is frontend-only. The existing logo, portal shell, navigation, backend APIs, authorizations, loan calculations and stored financial records were not changed by this task. Existing uncommitted work was preserved.

## Shared components

- `Spinner`: original twelve-bar SVG with stepped rotation and current-color styling. No external GIF, copied image or new package is used.
- `LoadingIndicator`: inline, section and page variants; polite status announcements, contextual text, reserved section space and wrapping.
- `LoadingButton`: native disabled submission, contextual progress text and spinner only on the initiating control when a form shares its busy flag. Existing handlers, form associations and refs remain supported.
- `ProcessingOverlay`: native focus-managed dialog for loan issuance/status checks, delayed 350 ms, with background scroll lock and cleanup. Ordinary requests use button or section loading instead.

Spinner visibility is delayed 140 ms to avoid brief flashes; reduced-motion CSS uses a static twelve-segment indicator. No global Axios spinner or external loading asset was added.

## Covered workflows

Both portals share the same components, while existing role-specific actions remain intact:

- Login, forgot-password/OTP/reset submission and Settings security/email operations.
- Dashboard, employee/customer directory, portfolio, customer profile/photo, risk and history loading.
- KYC drafting, submission, approval/rejection/corrections, secure photo/document thumbnails, uploads, application preview and PDF/print actions.
- Loan issuance, detail tabs, installment lists, documents, receipts and payment history.
- Collections, allocation previews, recording payments/missed entries and Admin receipt verification.
- Missed payments, overdue follow-ups, Daily Settlement/Reconciliation, receiving accounts, financial review, PDF/Excel exports.
- Notification loading/read operations, profile photo updates and Settings saves.

The existing progress elements remain for uploads. Local actions such as resetting a login form or generating a password are not shown as server operations. Navigation and notification links remain ordinary controls.

## Financial request uncertainty

The pre-existing synchronous submission locks, persistent payment/settlement idempotency keys and backend protections remain intact. Pending markers are saved before loan/payment/settlement writes, so navigating or refreshing does not silently unlock an uncertain submission. No write is automatically retried.

- A lost payment response triggers authorized loan payment-history lookup using the exact original request key; amount-only matching is never accepted.
- A lost loan response triggers authorized customer loan-history lookup using actual India issue day, original terms and system entry time. Existing active-loan protections remain authoritative.
- A lost settlement submission response is checked against authorized settlement history and the original request key. A review is checked against the latest record version.
- If a lookup cannot confirm the result, the UI keeps another financial submission blocked and offers a read-only status check. Absence from a paginated history is deliberately not treated as proof that a transaction failed; Admin review can still be necessary.
- A successfully acknowledged settlement is distinguished from a later failed dashboard refresh.
- Admin customer-payment review retains its existing reload-history guard after errors; company settlement verification remains separate.

No backend payload fields, calculations, allocation order, permissions or financial records were changed. The new requests are reads against existing authorized endpoints.

## Executed checks

- Frontend: 230 tests passed, including five new shared-loader/financial-outcome regressions. Existing installment-sequence tests remain unchanged.
- Backend: 48 suites / 434 tests passed using the existing isolated test infrastructure.
- Frontend ESLint and Vite production build passed.
- Browser: both actual portal shells with synthetic-only Axios responses, at 320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920 pixels.
- Checked all twelve SVG segments and changing CSS rotation transforms, only the clicked button spinning, other controls disabled during work, fast-operation overlay suppression, dialog focus/scroll locking and cleanup.
- Checked overlay bounds at all nine widths and payment recovery dialog/footer bounds at all nine widths, with no horizontal page overflow.
- Exercised actual AddLoan and RecordPaymentModal with a synthetic committed write followed by a lost response. Each made one synthetic POST and recovered through history. Unresolved payment history stayed blocked after a manual status check and a browser reload.
- A fresh final Admin browser fixture had no console errors or warnings.

Browser artifacts and full test logs: `tmp/loading-system/`. The isolated fixture has no database connection. Screenshots show synthetic verification views, not real financial transactions.

## Verification limits

No real-device Android/iPhone or Safari testing was performed. Not every production route/action was exercised end-to-end in the browser. Live SMTP/OTP, actual KYC file transfers, live database financial mutations and live company settlement approvals were intentionally not performed. Reduced-motion behavior is implemented and source-checked; an OS-level accessibility preference change was not simulated. Unresolved history lookups conservatively require further authorized review.

## Implementation and test files changed in this task

- `frontend/src/components/CustomerForm.jsx`
- `frontend/src/components/CustomerPhoto.jsx`
- `frontend/src/components/CustomerPhotoPreview.jsx`
- `frontend/src/components/CustomerRisk.jsx`
- `frontend/src/components/CustomerTable.jsx`
- `frontend/src/components/EmailPreferences.jsx`
- `frontend/src/components/EmployeeAvatar.jsx`
- `frontend/src/components/EmployeeCustomerPortfolio.jsx`
- `frontend/src/components/EmployeeTable.jsx`
- `frontend/src/components/KycApplication.jsx`
- `frontend/src/components/KycPdfPreview.jsx`
- `frontend/src/components/LoanDetailsView.jsx`
- `frontend/src/components/NotificationBell.jsx`
- `frontend/src/components/PortalLogin.jsx`
- `frontend/src/components/ProfilePhotoDialogs.jsx`
- `frontend/src/components/ProfilePhotoEditor.jsx`
- `frontend/src/components/RepaymentSpeedometer.jsx`
- `frontend/src/components/admin-loans/AdminLoanPresentation.jsx`
- `frontend/src/components/collections/AdminCollections.jsx`
- `frontend/src/components/collections/PaymentReviewModal.jsx`
- `frontend/src/components/collections/RecordPaymentModal.jsx`
- `frontend/src/components/collections/RecoveryCollections.jsx`
- `frontend/src/components/customers/AdminCustomerFields.jsx`
- `frontend/src/components/dashboard/CollectionInsights.jsx`
- `frontend/src/components/dashboard/EmployeeWorkspace.jsx`
- `frontend/src/components/directories/DirectoryUi.jsx`
- `frontend/src/components/kyc/KycFormUi.jsx`
- `frontend/src/components/loans/LoanDocuments.jsx`
- `frontend/src/components/loans/LoanInstallments.jsx`
- `frontend/src/components/loans/LoanPayments.jsx`
- `frontend/src/components/loans/LoanTabPanel.jsx`
- `frontend/src/components/loans/LoanUi.jsx`
- `frontend/src/components/portfolios/PortfolioUi.jsx`
- `frontend/src/components/reconciliation/AdminReconciliation.jsx`
- `frontend/src/components/reconciliation/ReconciliationTables.jsx`
- `frontend/src/components/requests/RequestPresentation.jsx`
- `frontend/src/components/ui/Loading.jsx`
- `frontend/src/components/ui/Primitives.jsx`
- `frontend/src/components/ui/loading.css`
- `frontend/src/pages/admin/AddCustomer.jsx`
- `frontend/src/pages/admin/AddEmployee.jsx`
- `frontend/src/pages/admin/CustomerDetails.jsx`
- `frontend/src/pages/admin/CustomerLeads.jsx`
- `frontend/src/pages/admin/Dashboard.jsx`
- `frontend/src/pages/admin/EditEmployee.jsx`
- `frontend/src/pages/admin/EmployeeDetails.jsx`
- `frontend/src/pages/admin/EmployeeList.jsx`
- `frontend/src/pages/admin/Loans.jsx`
- `frontend/src/pages/admin/MissedPayments.jsx`
- `frontend/src/pages/employee/AddLoan.jsx`
- `frontend/src/pages/employee/CustomerDetails.jsx`
- `frontend/src/pages/employee/CustomerList.jsx`
- `frontend/src/pages/employee/Dashboard.jsx`
- `frontend/src/pages/employee/EditCustomer.jsx`
- `frontend/src/pages/employee/Loans.jsx`
- `frontend/src/pages/employee/PasswordRecovery.jsx`
- `frontend/src/pages/employee/Receipt.jsx`
- `frontend/src/pages/employee/TodayCollections.jsx`
- `frontend/src/pages/shared/DailySettlement.jsx`
- `frontend/src/pages/shared/FollowUps.jsx`
- `frontend/src/pages/shared/NotificationHistory.jsx`
- `frontend/src/pages/shared/Settings.jsx`
- `frontend/src/utils/financialOutcome.js`
- `frontend/tests/loadingSystem.test.mjs`
