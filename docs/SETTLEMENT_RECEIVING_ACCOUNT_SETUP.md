Receiving-account review — 23 October 2026

The configured database was inspected with MongoClient reads only. No receiving accounts were configured. Two positive customer collection records existed, both dated 29 July 2026 in Asia/Kolkata. Neither had a Phase 2 custody position. No collection-to-loan employee assignment mismatches or collections assigned to missing employees were found. Some employee accounts had no recorded customer payments. Assigned customers, loans and scheduled installments do not count as money received.

Admin setup:
1. Open http://localhost:5173/admin/login and sign in as Admin.
2. Select Daily Reconciliation in the sidebar (http://localhost:5173/admin/reconciliation).
3. Select Receiving accounts at the top, or Set up receiving accounts in the empty-state banner. The existing manager opens directly under the page header.
4. Set Owner to COMPANY. Enter a meaningful verified account/location label.
5. For physical cash handovers, select CASH only. This authorizes a cash receiving location; bank/UPI details are not required.
6. For company UPI, select UPI and enter the actual authorized company UPI details. For company bank destinations, select BANK_TRANSFER and enter the verified bank account and routing details. Digital details are encrypted at rest; only a masked suffix is returned in account lists. Cash locations must be separate from digital accounts.
7. Select Authorize account. The account is active immediately and available to all active employees for compatible settlement types. There are currently no branch-specific destination restrictions in this model.
8. Use Disable account / Enable account to manage authorizations. Disabled company destinations disappear from employee choices. Existing history is retained. Account identity details cannot be overwritten: disable an obsolete authorization and create a verified replacement.
9. If employees receive digital collections in their own accounts, separately authorize each source using Owner EMPLOYEE and Authorized employee. These source accounts are visible only to the assigned employee and Admin. Disabled employee source accounts may remit already recorded available funds, but cannot receive new collections.

Employee flow:
1. Open Employee Portal → Daily Settlement (http://localhost:5173/employee/settlements).
2. Select Physical cash handover or Employee digital funds → company.
3. Select Company receiving account. Cash lists active company CASH locations. Digital lists active company UPI or BANK_TRANSFER destinations. Employee accounts cannot be used as company destinations.
4. If Admin just configured accounts, select Refresh destinations. Form values and selected proof remain intact. Missing configuration explains the Admin navigation path and blocks submission; API failures show an error with Retry / refresh rather than claiming no accounts exist.
5. For digital transfers choose your source account and enter the actual transaction reference. Submit only available classified funds. Pending/disputed submissions already reserve their allocation.
6. Admin opens Daily Reconciliation → Settlement history → Review settlement, records independent company evidence (cash count for cash; company bank/provider evidence for digital) and approves, rejects or disputes. Employee proof alone cannot approve a transfer.

Investigating zero customer payments:
- From date / Through date now visibly show the server's effective dates. The default is today in the configured settlement timezone (Asia/Kolkata unless changed).
- To inspect the existing older records, set both dates to 2026-07-29 and Apply filters. Employee views remain scoped to their recorded employee assignment. Admin can select the relevant Employee and clear method/search/area filters as needed.
- The activity list now includes both custody positions and older collection records without positions. Older rows are labeled historical / unclassified. They do not become available for settlement merely by being viewed.
- Admin must inspect original evidence in Historical custody classification before explicitly classifying older custody. This must not re-credit the customer's loan or infer that historical funds are still held. Review past remittances separately before creating a settlement.
- Search applies to collection number/reference; collection method applies to payment rows. Settlement status applies to settlement history, not customer payment counts. Missed/zero-value installments are not received payments.

Code changes are additive: dashboard adds payments, paymentsTotal and legacyPaymentsInPeriod; positions and its meaning remain unchanged for existing consumers/exports. No schema migration or automatic financial backfill is performed. Configured financial collections are fingerprinted before/after the review; tests and browser writes use disposable MongoDB replica sets only.
