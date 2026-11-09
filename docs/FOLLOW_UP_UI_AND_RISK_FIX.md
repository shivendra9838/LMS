# Overdue Follow-ups, risk badges and notification preview

## Implemented

The Employee follow-up workspace now uses the existing My Loans navy shell, panels, borders and gold styling. It includes a compact icon/title/refresh header, mobile filter accordion, five summary cards, global sorting, two-column desktop customer cards and single-column phone cards. Customer code, assigned employee, mobile, original overdue dates, partial balances, contact links, risk details and history actions remain available.

Existing follow-up forms, reasons, promises, idempotency, audit history and ownership checks are preserved. No call or WhatsApp message is sent automatically. Contact links do not record follow-ups; saving a note is still an explicit separate action.

Four sort orders are implemented in the existing read API **before pagination**: amount descending, overdue days descending, oldest unpaid date and customer name. Search previously checked only name/loan number; it now also checks the already-authorized customer code and mobile. Overdue calculations and summary formulas are unchanged.

The notification bell now requests/displays at most four latest unread rows. Mark All Read is in the header; the unread count still represents the full inbox. Mobile preview height is capped at 50dvh with internal scrolling. Width uses the usable viewport rather than `100vw`, which initially pushed the panel left of the screen on scrollbar-equipped 320/375px viewports. The popup retains read/unread handling, SSE updates, role-based targets, View All, Escape/outside/close-button handling and navigation closure. The full inbox is unchanged.

## Actual database risk investigation

Read-only inspection of the configured `loan_management` database on business date **2026-11-04 Asia/Kolkata** found:

| Customer/loan | Current backend category | Published score | Result |
|---|---|---|---|
| shivendra | REVIEW_REQUIRED | 67 | Established rating; Employee batch response includes it. |
| LN000002, saved as “Abhiskeh Bhaskar” | REVIEW_REQUIRED | null | UNRATED; the backend intentionally withholds a numeric score under its verified-history policy. Employee batch response includes it. |

Customer and loan assignments matched in both cases. The latest persisted shivendra audit snapshot was from the prior business day with score 77; current batch reads recalculate from schedules and payment evidence instead of returning that snapshot. LN000002's current and saved categories agreed.

No current backend category error or ownership mismatch was found. The existing null score must not be turned into a fabricated number. The backend can require review because of adverse behavior while withholding a numeric score for insufficient evidence.

UI weaknesses addressed:

- Unknown/missing risk categories could render an empty badge label; they now explicitly show **Risk Not Assessed**.
- A missing customer reference no longer silently removes the risk state.
- A known Review Required category remains visible with null/undefined score; an unrated category shows **Not Rated Yet**. A legitimate numeric zero is displayed.
- The Follow-ups page's local Refresh revision previously did not propagate to the grouped risk batch when customer IDs were unchanged. It now does.
- My Loans list now uses the same grouped `CustomerRisk`/`RiskBadge` presentation as loan details and Follow-ups, without per-row assessment requests.

No risk threshold, weighted calculation or policy version changed. No live risk snapshots or financial records were rewritten during this inspection. The read-only assessment path was used instead of the detail endpoint that persists an audit snapshot.

## Changed files

- `frontend/src/pages/shared/FollowUps.jsx`
- `frontend/src/pages/shared/follow-ups.css`
- `frontend/src/pages/employee/Loans.jsx`
- `frontend/src/components/CustomerRisk.jsx`
- `frontend/src/components/customer-risk.css`
- `frontend/src/components/NotificationBell.jsx`
- `frontend/src/components/notification-bell.css`
- `backend/src/services/followUp.service.js`
- `backend/tests/integration/followUps.integration.test.js`
- `frontend/tests/customerRisk.test.mjs`
- `frontend/tests/notificationPreview.test.mjs` (new)
- This report and screenshots under `docs/screenshots/followup-ui`.

The existing shared responsive panel component and My Loans styling were reused. No new dependencies, endpoint, schema or financial write flow were introduced. Existing uncommitted work was preserved.

## Executed tests

- **Backend: 39 suites / 350 tests passed**, coverage gates enabled; 227.819 seconds. This includes new mobile/code search, all global sorts before pagination, invalid sort rejection and financial read-only snapshot assertions.
- **Frontend: 136 tests passed**, zero failed/skipped. New regressions cover review-with-null-score, legitimate score zero, unknown categories and a four-row notification cap with full unread count/header controls.
- **Frontend lint and production build passed** after the final CSS fixes.
- Logs, verification build and responsive matrix: `tmp/followup-ui`.

## Browser verification

Used a disposable MongoMemoryReplSet fixture on ports 5017/5187. Fixture alerts were generated by the existing due-reminder service from its saved synthetic installment schedules. No synthetic financial records or notifications were created in configured Atlas.

**32 checks** covered page, expanded filters, notification popup and risk dialog at **320, 375, 390, 430, 768, 1024, 1366 and 1920px**. After correcting the small-screen popup width, no page/card/dialog overflow, oversized filter inputs or out-of-viewport popups remained. Phone popup height was 422px in an 844px viewport, with four rows and internal scrolling. My Loans received four additional width checks at 320, 390, 768 and 1366px with no overflow.

Actual browser interactions verified:

- Login, follow-up list, refresh, long customer names and backend-derived unrated Review Required badges.
- Correct customer's risk modal, score-history explanation and responsive dialog.
- Amount sorting, mobile search, clear filters, empty results, invalid min/max filter validation and recovery from that validation error.
- Follow-up/history opened the correct loan. An explicitly labeled isolated UI note was saved and displayed with its author, contact date, creation timestamp and “Reason not recorded”. It stated that no actual customer call/message was made. Summary contact/reminder counts refreshed.
- Call URL and WhatsApp prepared-message URL were checked. **No call was placed and no WhatsApp message was sent.**
- Payment History opened the existing correct loan and its one ₹800 synthetic receipt, with allocation and actual received-date history intact.
- Notification preview showed four of six unread alerts. Clicking a notification opened the correct loan history and closed the popup; unread count became five. Mark All Read cleared all remaining unread alerts, not just the four shown. View All opened the existing inbox and closed the popup.
- Escape, close button and an outside profile-menu click closed the preview. Clicks on text physically behind the preview were not counted as successful outside-click checks.

Desktop/mobile screenshots contain disposable fixture data only. Geometry checks are browser viewport checks, not physical-device testing.

## Normal local application and limits

The normal backend was restarted with the read-only search/sort improvements and connected to its configured MongoDB. The unauthenticated follow-up API returned 401; the normal frontend URL returned 200. The application remains available at http://localhost:5173/employee/follow-ups.

The two named live assessments were verified through read-only backend services; authenticated browser interactions used isolated records, not the live customers. Physical Android/iPhone keyboard, dialer and WhatsApp-app behavior remain manual. Expected invalid-filter HTTP 422 responses were deliberately exercised; these were not hidden as successful requests.

No existing customer, loan, schedule, collection, settlement, KYC, follow-up or risk audit record in the configured database was reset or repaired. No actual customer contacts or external messages were made. A comprehensive before/after Atlas financial hash comparison was not performed.

Manual acceptance: open Employee > Overdue Follow-ups; inspect both named loans, open their risk details, try filters/sorts and existing history links, then test the compact bell, Mark All Read and View All on your phone. LN000002 should show Review Required with no fabricated numeric score while its backend status remains UNRATED.
