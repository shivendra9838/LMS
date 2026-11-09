# Phase 2 - Daily collection, settlement and reconciliation

## Implemented workflow

Employee: record the customer payment once using the existing collection form. For UPI, bank transfers and cheques, choose the actual authorized receiving account and enter its reference. Company-direct payments remain pending verification. Employee-received UPI and bank funds create employee custody; cash creates a separate cash custody balance.

Employee: open **Daily Settlement**, review the cash/digital balances and choose **Submit settlement**. Cash handovers select a company cash receiving location. Digital remittances select the employee's actual source account and the company's actual destination, plus the transfer reference. Amounts may be partial. Optional JPEG/PNG/PDF proof is encrypted and private. Pending and disputed submissions reserve funds and cannot be allocated a second time.

Admin: open **Daily Reconciliation**. Review submissions and their history. Cash approval requires an Admin cash count matching the submission. Digital approval requires matching Admin-supplied company bank statement or UPI-provider evidence, amount, account and reference. Employee-uploaded proof cannot authorize bank confirmation. Disputes record the observed amount and difference while retaining the reservation. Rejection releases it; the employee can submit a linked correction. A verified settlement can be reversed only by an Admin with a reason. Company payment verification can also be explicitly reversed and re-reviewed; supplemental evidence is appended without removing the original.

Bank verification is an authenticated human review of uploaded company evidence. No bank feed, bank API, OCR verification, or automatic authenticity checking is claimed. Admins must inspect the actual statement/provider record before approval.

## Accounting invariants

- Monetary amounts in the custody ledger, evidence and settlements use integer paise with bounded safe arithmetic. Collection posting normalizes decimal input before cash-book updates; interest formulas and schedule generation are unchanged.
- A customer collection posts once to the existing loan, installment payment status, receipt and recovery ledger. Settlements and verification actions never create another collection or recovery cash-book entry and never credit the customer's loan again.
- Cash positions cannot fund digital settlements. A digital settlement can consume only recorded funds from its selected employee source account. Disabling an account stops new receipts while allowing remittance of already-held funds.
- At every position: `0 <= settledMinor + reservedMinor <= amountMinor`. Current liability is `amountMinor - settledMinor`; available funds subtract reservations as well.
- Per-payment settlement status is derived from those canonical counters: UNSETTLED, AWAITING_ADMIN, PARTIALLY_SETTLED or SETTLED; company-direct payments are NOT_APPLICABLE and unknown destinations are UNCLASSIFIED. Receipts and payment activity expose it without storing a second inconsistent balance/status.
- Allocation, reservation, final review/reversal, reference claims and financial audit writes use MongoDB transactions. Version checks and transactional retries protect concurrent operations. Partial and multiple settlements allocate oldest eligible funds first.
- Account-scoped normalized references are claimed uniquely across customer payments and employee transfers. New client submissions require persistent request keys. Replaying the same payload returns the same record; changed payloads using the key conflict. Rejected digital corrections can reuse their original reference through a controlled claim transfer, with the old submission and audit history retained.
- Bank evidence has one primary claim per account/reference. Matching evidence can be retried; corrected supporting files are appended as supplements. Evidence is bound to the posting/correction chain and cannot verify an unrelated posting.
- Reversals preserve original amounts, dates, references and evidence. They restore custody using audited allocation counter-entries; posted transactions are never deleted.

## Backward compatibility and historical records

No automatic financial migration or backfill runs. Existing Collection fields, payment methods, original payment dates, loan balances, schedules and cash-book entries remain present. Historical collections without a position are displayed as **unclassified**, excluded from eligible remittance balances, and require explicit Admin custody classification with a reason. Classification creates a separate ledger position without changing the original collection or crediting its loan again. Previously completed handovers must be entered and verified against their original evidence after classification, rather than assuming all historical cash is still held.

Legacy collection API calls remain accepted. Digital calls without destination metadata produce an unclassified position, never a bank-confirmed payment. Admin legacy cash calls also remain unclassified because the physical receiver is unknown. The updated UI sends `financeVersion: 2` and requires an account/reference for digital payments plus an idempotency key. Admin v2 cash calls must explicitly identify the assigned employee who received the cash.

The existing CashBook remains a backward-compatible customer-recovery ledger: its old cashIn/closing totals combine historic payment channels and must not be interpreted as physical cash custody. New recovery entries are tagged with `fundChannel`. **Daily Reconciliation is the authoritative separate cash/digital employee-custody view.** Settlements never inflate CashBook or customer-collection revenue totals.

## Models and indexes

New models: `PaymentAccount`, `CollectionPosition`, `EmployeeSettlement`, `FinanceReference`, `FinanceEvidence`, `FinanceSequence`.

- PaymentAccount: immutable encrypted receiving details, masked labels, owner, authorized employee, modes and active status. A keyed fingerprint prevents direct duplicate account registrations.
- CollectionPosition: one unique position per collection; cash/UPI/bank/company/unknown custody, integer amount/reservations/settled counters, verification evidence, dates and versions. Employee/bucket/payment-date and verification/date indexes.
- EmployeeSettlement: amounts, company destination, employee source, immutable allocations, submission date, review/verification dates, status, version, correction root/link. Unique employee/request-key and unique correction-per-predecessor indexes.
- FinanceReference: unique account/normalized-reference claim across collections and settlements.
- FinanceEvidence: encrypted bytes, MIME/digest, source, target/correction root, amount/reference, observation/upload dates, authorized actor. Unique primary company account/reference evidence index.
- FinanceSequence: transactional collection-number counter initialized from the highest existing numeric COL number, preserving existing receipt identifiers.
- Collection gains optional finance routing, reference, role and request-key/hash metadata; its actor/request-key index is partial so historical rows remain valid.
- CashBook entries gain an additive `fundChannel`; AuditLog gains a module/reference/date index.

Financial writes ensure the required collections/indexes exist before starting their transaction. Index failures fail the write; nothing removes duplicate data automatically.

## API surface

All paths below are under `/api/v1`, authenticated, account-status checked, role/ownership scoped and non-cacheable for financial responses.

| Method/path | Use |
| --- | --- |
| POST `/collections` | Existing payment endpoint, extended with destination, reference and idempotency metadata |
| GET `/settlements/accounts` | Admin list; employees receive company and their own masked accounts |
| POST `/settlements/accounts` | Admin authorizes receiving account |
| PATCH `/settlements/accounts/:id` | Admin enables/disables future use |
| GET `/settlements/dashboard` | Scoped breakdown, current liabilities, history and legacy review |
| POST `/settlements` | Employee submits/remits eligible funds |
| GET `/settlements/:id` | Scoped submission, history and permitted proof metadata |
| POST `/settlements/:id/review` | Admin approve, reject, dispute or reverse |
| POST `/settlements/:id/evidence` | Employee optional proof or Admin company/count evidence |
| POST `/settlements/positions/:id/evidence` | Admin company-direct supporting evidence |
| POST `/settlements/positions/:id/review` | Admin verify, dispute or reverse verification |
| POST `/settlements/legacy/:id/classify` | Explicit Admin classification; original collection unchanged |
| GET `/settlements/proofs/:id` | Authorized private download; bank documents are Admin-only |
| GET `/settlements/export/xlsx` or `/pdf` | Scoped reports with summaries, all matching collection/settlement rows and definitions |

Dashboard filters: employeeId, branchId, employee area, from/to business dates, collection method, settlement status, history/reference search and page. Rows paginate at 25; exports include all matching rows. Dates filter original collection activity and submission history. Verified settlement totals use verification dates. Liabilities, source-account availability and pending reservations remain current/all-time. Earlier outstanding means earlier collections still outstanding now, not a historical opening snapshot. Status filters scope settlement totals/history; search filters transaction rows, not liability balances. Method filters use allocations; differences are attributed only when the entire transfer is included. Branch/area filtering uses the current employee roster.

## Setup and operational checks

1. Keep the existing persistent `KYC_ENCRYPTION_KEY`; financial account details and proof files reuse AES-256-GCM. Never rotate/replace it without a coordinated re-encryption migration and backup.
2. MongoDB must support transactions (replica set or sharded deployment) and the partial indexes used here (MongoDB 6+). The isolated tests use MongoDB 8.2.6.
3. Set `SETTLEMENT_TIME_ZONE` if necessary; default is `Asia/Kolkata`. Timestamps remain UTC. This controls this module's date boundaries and does not regenerate existing installments.
4. Run `node scripts/settlement-readiness.js` for a schema-only preview. The operator may run `node scripts/settlement-readiness.js --apply` from backend to check the configured deployment and create additive indexes. No records are migrated/deleted. This task did not run that command against the configured database.
5. In Admin -> Daily Reconciliation -> Receiving accounts, authorize real company cash/UPI/bank destinations and employee receiving accounts. Digital accounts can support multiple selected methods; cash locations remain separate. Use stable labels and accurate canonical account/UPI details; the normal UI returns masked values only. Ownership/details are immutable; enable/disable existing authorizations instead of duplicating an account.
6. Before accepting historical balances, classify legacy records and reconcile prior handovers with original evidence. Do not treat unclassified figures as established employee debt.

## Test and acceptance workflow

Files added in this phase:

- `backend/src/models/{PaymentAccount,CollectionPosition,EmployeeSettlement,FinanceReference,FinanceEvidence,FinanceSequence}.js`
- `backend/src/services/{settlement,reconciliation,reconciliationExport}.service.js`
- `backend/src/routes/settlement.routes.js`, `backend/src/utils/money.js`
- `backend/scripts/settlement-readiness.js`, `backend/.env.settlement.example`
- `backend/tests/integration/settlement.integration.test.js`, `backend/tests/unit/{money,reconciliationDates,financialCompatibility}.test.js`
- `frontend/src/pages/shared/DailySettlement.jsx`, `frontend/src/utils/requestKey.js`
- This implementation/setup guide.

Existing files extended: `backend/src/app.js`; models `Collection.js`, `CashBook.js`, `AuditLog.js`; services `collection.service.js`, `cashBook.service.js`; `utils/generateCode.js`; `controllers/collection.controller.js`; `validators/collection.validator.js`; `frontend/src/App.jsx`; both portal layouts; `components/collections/RecordPaymentModal.jsx`; and `pages/employee/Receipt.jsx`. Earlier uncommitted work was preserved.

Automated suites use disposable MongoDB replica sets and synthetic identities. They never connect to the configured business database. Test command:

```powershell
# Use the installed isolated-test MongoDB binary if the default cache is not writable.
$env:MONGOMS_SYSTEM_BINARY = '<absolute path to the installed test mongod binary>'
npm test -- --runInBand
```

Frontend: `npm run lint`, `npm run build` (the task built outside the existing tracked frontend/dist directory). Test evidence/logs/screenshots are in ignored `tmp/phase2/`.

For acceptance, use a staging replica set and synthetic accounts. Record cash, company-direct UPI, employee UPI, company bank and employee bank payments; confirm each loan credit appears once. Submit partial cash/digital settlements, check a second submission cannot consume reserved funds, and approve with independent evidence. Dispute/reject a submission, verify funds stay reserved/release respectively, and resubmit a linked correction. Test repeated request keys/references, competing submissions, Admin reversals, supplemental evidence, employee isolation, account disabling and report totals. Ensure company-direct payments never become verified from employee proof alone.

Real Android camera/file-picker behavior, native printing, real bank-document authenticity, production account configuration and production-scale load remain manual deployment/acceptance checks. No real-device testing or production-bank reconciliation is claimed.
