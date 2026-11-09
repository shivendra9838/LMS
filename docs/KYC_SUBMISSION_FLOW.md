# Employee KYC submission and verification flow

Implemented 7 November 2026, using the existing KYC APIs, editor, records list, secure document/PDF components, loading components and real-time refresh hook.

## Changes

- Submission immediately opens the shared processing dialog with “Submitting KYC...” and the secure-submission message. The existing synchronous request lock and disabled actions prevent repeated clicks. No fixed minimum display time or artificial production delay was added.
- After draft persistence and the actual successful submit response, the employee is redirected to /employee/customers/kyc. The existing records API loads the submitted entry and authoritative status counts. A green, dismissible success toast is shown.
- A failed submission clears processing, shows existing server errors and keeps the entered/saved draft data. New draft routing retains the saved KYC reference, preventing a retry from creating another draft simply because submission failed.
- Pending, Approved, Rejected and Corrections Required show a status-specific verification page. Names, reference, submission/approval dates and reasons come from the authorized KYC response/history. Missing information is identified as not recorded; no review-time promise is invented.
- View Submitted Application opens the existing read-only editor with document/PDF/history actions. Returned records provide a separate Update & Resubmit KYC action that opens the existing authorized edit workflow. Drafts remain editable. Admin review screens remain unchanged.
- Employee views refresh through the existing inbox/focus/poll mechanism. Background reads do not replace unsaved field changes or interrupt an in-flight action.
- The approved logo, shared shell/navigation, list search/filter/pagination implementation, backend ownership/version checks and encrypted-file access remain unchanged.

## Implementation files

- frontend/src/pages/shared/CustomerKyc.jsx
- frontend/src/components/kyc/KycVerification.jsx — new shared presentation and submission toast
- frontend/src/components/kyc/kyc-verification.css — new scoped responsive styling
- frontend/src/components/ui/Loading.jsx — optional processing-dialog delay; default remains unchanged, KYC requests immediate display
- frontend/tests/kycVerification.test.mjs — five new regressions

No backend model/API or financial calculation changes were needed. No configured MongoDB customer, KYC, loan, payment or settlement data was modified by this task. Existing uncommitted work was preserved.

## Executed verification

- Full frontend suite: 235 tests passed.
- Full backend suite: 48 suites / 434 tests passed, including existing KYC validation, permissions, versions, secure documents and approval workflows using isolated test data.
- Final focused KYC/editor/shared-loading regressions: 17 passed.
- Frontend lint and production build passed.
- Isolated browser test mounted the actual CustomerKyc, KycList and PortalShell with synthetic Axios responses; no real database connection or email delivery.
- Existing-draft and new-application submissions: progress → confirmed redirect → success toast → one Pending Approval row and count of one. New flow issued exactly one synthetic create and one submit POST.
- Double-click submission issued one synthetic save and one submit POST. A slow, failed submit cleared the dialog/scroll lock, preserved the edited name and highlighted the real server-validation field.
- Pending View and refresh retained the status. Simulated Admin approval/rejection/corrections events caused real refresh-hook reads and displayed the correct headings, dates, reasons and correction action.
- Read-only submitted view contained the saved name, no save actions and no file-upload controls. Corrections opened the existing editable form. Browser Back restored verification view.
- Browser widths: 320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920. No horizontal page overflow; footer controls have at least 44px height. At 320px, scrolling to the footer placed both actions above the existing bottom navigation.
- Visually inspected desktop/mobile captures. Fixed dark-theme heading-color inheritance on the white panel and rechecked computed dark text color.
- Browser console had no warnings or errors.

Logs and synthetic preview screenshots: tmp/kyc-submission-flow/.

## Manual acceptance

1. Use an authorized test employee and complete an actual KYC with required documents.
2. Submit once and confirm loading lasts only as long as the request, then the list shows Pending Approval and the success toast.
3. Open View; check the status/reference/date and View Submitted Application, documents, PDF/print and Back actions.
4. Use Admin to approve, reject or request corrections on that test application. Return to the employee record and verify its real status and remarks.
5. Check the flow on a physical Android phone/iPhone, including keyboard and browser safe areas.

Physical-device/Safari testing and live database submission/approval were not performed. Browser Admin outcomes were simulated; backend authorization/approval tests used isolated MongoDB test databases. No production/test-account customer records were created for this task.
