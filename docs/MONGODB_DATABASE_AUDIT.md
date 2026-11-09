# Royal Enterprises LMS — MongoDB health, storage, security and scalability audit

Audit: 7 November 2026. Database: **loan_management**. Measurement timestamps are preserved in the aggregate evidence under `tmp/mongodb-audit/`. The M0 tier and 512 MB allowance are user-supplied; Atlas control-plane settings were not accessible for independent confirmation.

## 1. Current health and audit boundaries

**Suitable for small-scale development at the current size. Not ready for production until privilege, secret, backup and scalability findings are addressed.** No inconsistency was detected by the bounded checks below; this is not a certification of every historical business event or actual bank receipt.

| Measured item | Result |
|---|---:|
| Collections | 35 |
| Documents | 980 |
| Indexes | 140 |
| Uncompressed BSON | 5,169,172 bytes / 4.930 MiB |
| Index bytes | 4,554,752 bytes / 4.344 MiB |
| BSON + indexes, quota-relevant estimate | **9.273 MiB** |
| Allocated collection storage | 7.422 MiB |
| Allocated collection storage + indexes | 11.766 MiB |
| Estimated remaining within a 512 MiB planning envelope | **502.727 MiB** |
| Estimated utilization of that envelope | **1.81%** |

The earlier supplied 9.23 MB reading is close to the current measurement. Logical and allocated storage differ: unused allocated pages can remain after previous operations. Do not add BSON and allocated storage together. Other databases on the same cluster were not inventoried, so confirm cluster-wide Logical Size before treating this as exact available cluster capacity.

MongoDB defines Free storage usage as uncompressed BSON plus indexes. Its documented Free limits include 0.5 GB storage, 100 operations/second, 500 connections and a 32 MB in-memory sort limit; temporary disk spill is unavailable. These are cluster limits, not guaranteed application throughput. This report uses the requested 512 MiB envelope explicitly for planning. [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)

**Read-only method:** a separate raw MongoDB driver client, maximum two pooled connections, retryWrites disabled, exact database-name guard, metadata commands, bounded aggregates and queryPlanner-only explains. Aggregates used maxTimeMS 3,000; financial selection projected only references/numeric state and had a 10,001-document cap. No application data API was used. Schema inspection used disconnected Mongoose with autoCreate/autoIndex disabled.

No records, collections, indexes, application code, settings, keys or UI were changed. No seed, repair, restore, load test, KYC decryption or financial write test was run. Live metadata window: 2026-11-07T19:02:09.404Z to 2026-11-07T19:02:12.639Z UTC. Local evidence contains aggregate sizes/counts and index/configuration-status metadata, without customer identities, document contents, ciphertext or secrets. Existing background application activity was not paused; observations are not a globally atomic snapshot or a database checksum/validate operation.

## 2. Collection-wise storage — measured

Sizes are **KiB (1,024 bytes)**. BSON is stored document size; average/max refer to individual documents. Empty collections can occupy allocated/index pages.

| Collection | Documents | BSON KiB | Avg KiB | Max KiB | Allocated KiB | Index KiB | Indexes |
|---|---:|---:|---:|---:|---:|---:|---:|
| accountrequests | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 12.00 | 3 |
| accountsettings | 3 | 821.68 | 273.89 | 361.58 | 1,320.00 | 72.00 | 2 |
| activitytimelines | 0 | 0.00 | 0.00 | 0.00 | 32.00 | 104.00 | 4 |
| admins | 2 | 0.54 | 0.27 | 0.28 | 36.00 | 72.00 | 2 |
| auditlogs | 600 | 169.45 | 0.28 | 0.80 | 80.00 | 352.00 | 8 |
| branches | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 12.00 | 3 |
| cashbooks | 6 | 4.72 | 0.79 | 1.32 | 36.00 | 108.00 | 3 |
| collectionpositions | 8 | 2.50 | 0.31 | 0.36 | 36.00 | 144.00 | 4 |
| collections | 8 | 6.52 | 0.82 | 1.13 | 36.00 | 504.00 | 14 |
| companysettings | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 4.00 | 1 |
| customerdisplayphotos | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 8.00 | 2 |
| customerleads | 3 | 14.28 | 4.76 | 5.36 | 44.00 | 180.00 | 5 |
| customerpaymentreviews | 6 | 1.08 | 0.18 | 0.21 | 36.00 | 72.00 | 2 |
| customerriskassessments | 21 | 79.77 | 3.80 | 5.19 | 60.00 | 108.00 | 3 |
| customers | 2 | 1.01 | 0.51 | 0.51 | 36.00 | 540.00 | 15 |
| customertimelines | 6 | 0.95 | 0.16 | 0.16 | 36.00 | 72.00 | 2 |
| emailchallenges | 0 | 0.00 | 0.00 | 0.00 | 24.00 | 128.00 | 4 |
| emailcontrols | 1 | 0.05 | 0.05 | 0.05 | 36.00 | 36.00 | 1 |
| emailjobs | 11 | 3.23 | 0.29 | 0.31 | 36.00 | 180.00 | 5 |
| employees | 3 | 1.13 | 0.38 | 0.38 | 36.00 | 288.00 | 8 |
| employeesettlements | 1 | 0.65 | 0.65 | 0.65 | 36.00 | 112.00 | 4 |
| expenses | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 16.00 | 4 |
| financeevidences | 2 | 373.85 | 186.92 | 272.23 | 788.00 | 108.00 | 3 |
| financereferences | 2 | 0.28 | 0.14 | 0.14 | 36.00 | 72.00 | 2 |
| financesequences | 2 | 0.08 | 0.04 | 0.04 | 36.00 | 36.00 | 1 |
| kycdocuments | 18 | 3,475.12 | 193.06 | 479.73 | 4,480.00 | 72.00 | 2 |
| kycsubmissions | 5 | 7.57 | 1.51 | 1.59 | 44.00 | 72.00 | 2 |
| loans | 2 | 0.86 | 0.43 | 0.44 | 36.00 | 288.00 | 8 |
| loanschedules | 90 | 15.17 | 0.17 | 0.19 | 36.00 | 252.00 | 7 |
| loantimelines | 12 | 2.11 | 0.18 | 0.20 | 36.00 | 72.00 | 2 |
| notificationdispatches | 25 | 1.57 | 0.06 | 0.06 | 36.00 | 36.00 | 1 |
| notifications | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 4.00 | 1 |
| overduefollowups | 0 | 0.00 | 0.00 | 0.00 | 4.00 | 16.00 | 4 |
| paymentaccounts | 4 | 1.32 | 0.33 | 0.38 | 36.00 | 108.00 | 3 |
| usernotifications | 137 | 62.52 | 0.46 | 0.56 | 52.00 | 188.00 | 5 |

KYC documents dominate BSON usage (~3.394 MiB), followed by account settings (~0.802 MiB, including private profile photos), finance evidence (~0.365 MiB), and audit logs (~0.165 MiB). Index bytes are about 47% of current BSON-plus-index usage; with very few business records, fixed page allocation exaggerates per-record index cost.

The largest measured document is 491,243 bytes (~0.469 MiB), in kycdocuments. None is near the **16 MiB BSON document limit**, but future generated PDFs and embedded arrays still need bounds. [MongoDB document limits](https://www.mongodb.com/docs/manual/reference/limits/)

KycApproval and KycVerificationSignature exist in current source but their collections were absent at measurement time. No persisted use of the new signed workflow was measured; no collection/index was created to test it.

## 3. KYC storage, encryption and duplication

All 18 measured KYC files are PNGs: six categories across three applications. All checked encryptedBytes fields are binary and present.

| Kind | MIME | Count | Avg source KiB | Max source KiB | Total source KiB |
|---|---|---:|---:|---:|---:|
| ADDRESS | image/png | 3 | 251.95 | 332.96 | 755.85 |
| BUSINESS | image/png | 3 | 196.35 | 235.81 | 589.06 |
| IDENTITY | image/png | 3 | 256.37 | 479.45 | 769.11 |
| INCOME | image/png | 3 | 139.66 | 211.27 | 418.97 |
| PHOTO | image/png | 3 | 138.81 | 307.07 | 416.43 |
| SIGNATURE | image/png | 3 | 173.55 | 271.76 | 520.65 |

Original file bytes total **3,553,349**; encrypted binary bytes total **3,553,853**. The 504-byte difference equals 28 bytes per file, consistent with the stored 12-byte nonce plus 16-byte GCM tag. BSON metadata adds a small further overhead. Digest grouping found **zero repeated file-digest groups**. Digest equality detects identical bytes, not visually identical re-encoded images.

Source findings:

- [kycCrypto.js](C:/Users/shive/Desktop/LMS/backend/src/utils/kycCrypto.js) uses AES-256-GCM, fresh random nonces and authenticated tags; a missing/non-64-hex-character key fails closed. The persistent key's format passes. Its value, entropy and external recovery custody were not inspected or exposed.
- [kyc.service.js](C:/Users/shive/Desktop/LMS/backend/src/services/kyc.service.js) validates file signatures/content, rejects active/encrypted/over-complex PDFs, and requires images for customer photo/signature. Limits: 2 MiB/file, 30 retained files and 12 MiB original-file bytes per application including revisions, plus image pixel limits. **Original KYC uploads are not resized or recompressed before encryption.** Decodability checks are not malware scanning.
- Submissions reference existing document IDs rather than duplicating every file. Approved/revision evidence is intentionally retained. No existing file was compressed, replaced or deduplicated in this audit.
- Separate customer display photos already use cropped/resized WebP without overwriting KYC originals. Verification signatures normalize to PNG with 2 MiB/16-megapixel limits; normalization does not guarantee smaller files.
- JWT, active-account and employee ownership checks protect private retrieval, with no-store responses and encrypted fields excluded by default. Names/mobile numbers and ordinary profiles/financial fields are not all application-encrypted; DB/network/backup access still matters.
- Encryption has no explicit versioned key envelope/managed rotation procedure. Losing the key makes encrypted backups unusable. Plan versioned key IDs, protected escrow and rehearsed rotation; do not simply replace the existing key.

**High-risk future size path:** approval stores the complete encrypted finalized PDF in one KycApproval BSON document. Valid source files do not bound generated PDF size: source PDFs can expand during embedding, with added images/fonts. Add a pre-persistence artifact-size check and a safe private storage strategy in a separately authorized implementation. A failed approval must remain atomic.

Safe future optimization: legible image optimization before encryption, metadata stripping where appropriate, and private encrypted object storage for immutable originals/final PDFs with MongoDB references/digests and authenticated access. Preserve originals where evidence policy requires them; do not blindly downsample identity proofs or delete historical revisions. Object storage is a recommendation, not a current capability.

## 4. Average storage per customer

There are **two customers, two loans, three KYC applications and eighteen KYC files**. One application's files are not linked to a Customer, so dividing all file bytes by customer count overstates one completed application's file cost.

| Measured basis | Result |
|---|---:|
| Customer-linked KYC file sets | 2 sets / 12 files / 2,796,091 BSON bytes |
| Average linked KYC file set | **1,398,045.5 bytes / 1.333 MiB** |
| Linked file-set range | 1,177,112–1,618,979 bytes |
| Unlinked application file set | 762,427 bytes / 6 files |
| Entire database BSON divided by two customers | 2.465 MiB/customer |
| Entire database BSON + indexes divided by two customers | 4.637 MiB/customer |

The last two are observed all-in ratios, **not marginal costs**: they include staff photos, pending KYC, shared indexes and operational history. Current financial history contains only eight payments, not 90 completed installments. No finalized signed-PDF records exist in this measured sample, so their live average is unknown. Repeated renewals, revisions, receipts and audit history keep growing.

## 5. Capacity forecast — explicit estimates

Baseline **B = 6.607 MiB**: current BSON + indexes minus the two customer-linked KYC file sets. It conservatively retains pending KYC, staff photos, existing finance/audit history and fixed index pages. Some existing financial overhead is also included in the forward allowance; this is conservative, not exact attribution. Shared records will grow too.

Scenarios assume one initial KYC and one 45–60-day loan cycle per customer, with up to 60 actual receipt/review/custody events. No missed-day payments are invented.

- **1.7 MiB/customer, source-only cycle:** measured 1.333 MiB original KYC + assumed ~0.25 MiB for a completed financial/audit/notification/job cycle + assumed ~0.10 MiB marginal indexes/metadata, rounded. Excludes final signed PDF and new verifier images.
- **3.3 MiB/customer, signed-workflow planning:** adds assumed ~1.4 MiB finalized PDF and ~0.2 MiB combined verifier-image/metadata allowance. These two averages are **not measured in the live database**.
- **8 MiB/customer, heavier-file/revision scenario:** illustrative allowance for larger files, signed copies and revisions. It is not an upper bound; upload limits and repeated cycles permit substantially more.

Formula: **forecast MiB = B + customer count × scenario MiB/customer**. Ongoing global logs and additional cycles need extra budget.

| Customers | Source-only cycle MiB | Signed planning MiB | Heavier/revision MiB |
|---:|---:|---:|---:|
| 100 | 176.6 | 336.6 | 806.6 |
| 500 | 856.6 | 1,656.6 | 4,006.6 |
| 1,000 | 1,706.6 | 3,306.6 | 8,006.6 |
| 5,000 | 8,506.6 | 16,506.6 | 40,006.6 |
| 10,000 | 17,006.6 | 33,006.6 | 80,006.6 |

The 512 MiB envelope is reached around **297 / 153 / 63 customers** under the respective assumptions. A recommended **70% planning threshold** occurs around **206 / 106 / 43 customers**. These are storage illustrations, not supported concurrent-user limits. Around 100 signed customers can already justify planning a tier/storage change; 500 exceeds M0 in all scenarios above.

A calendar exhaustion date cannot be measured from one snapshot. Track weekly size, customer growth, file/PDF averages and audit growth. Time remaining = measured headroom / measured daily growth. Alert around 60%, plan by 70%, and avoid the hard ceiling. Query pressure can require upgrading sooner.

## 6. Financial integrity and transaction handling

Populated-reference checks found zero dangling references for customer/loan ownership, loans/customers, schedules, receipt parents, custody positions, settlement employee/account, KYC file/submission parents and receipt reviews. Duplicate checks found zero groups for customer code, loan number, loan/day schedule, receipt number, custody collection, receipt review, finance account/reference and settlement employee/idempotency key. Optional absent fields were not validated by those reference joins.

Bounded arithmetic checks scanned **2 loans, 90 schedules, 8 receipts, 8 positions, 1 settlement and 6 cashbook days**:

| Check | Anomalies found |
|---|---:|
| missingAllocationReferences | 0 |
| crossLoanAllocations | 0 |
| recordedPaymentsWithoutAllocationArray | 0 |
| newPaymentsWithoutIdempotency | 0 |
| receiptAllocationSumMismatch | 0 |
| scheduleCountMismatch | 0 |
| scheduleTotalMismatch | 0 |
| loanPaidVsReceiptsMismatch | 0 |
| loanRemainingArithmeticMismatch | 0 |
| schedulePaidVsAllocationMismatch | 0 |
| completedWithOutstanding | 0 |
| schedulesPaidAboveAmount | 0 |
| paidStatusWithUnpaidBalance | 0 |
| positionsOverReservedOrSettled | 0 |
| positionReceiptAmountMismatch | 0 |
| settlementAllocationSumMismatch | 0 |
| reservationsVsPendingSettlementsMismatch | 0 |
| settledVsVerifiedSettlementsMismatch | 0 |
| cashbookArithmeticMismatch | 0 |
| duplicateCashbookTransactionKeys | 0 |

These are internal consistency results, not independent proof of cash/bank receipt, identity validity or every historical event. No individual financial balance is disclosed.

Working protections in source: payment writes use session-bound transactions covering allocations, loan, cashbook, custody and audit; integer minor-unit helpers/planner preserve rounding; effective-date minimum and oldest-unpaid checks apply. Unique actor/idempotency indexes and request hashes distinguish valid retries. Atomic loan/receipt counters and unique loan/day indexes exist. Settlements conditionally reserve funds with version checks and transaction-bound review/reversal. Customer receipt verification is separate from company settlement verification. Overdue recovery remains schedule-derived after maturity.

Risks to address without changing historical records in this audit:

1. **High: cashbook contention and arrays.** Every payment for a business date appends to one CashBook document. Concurrent employees contend on it; entries can grow toward BSON limits. Backdated postings recalculate later cashbook days, potentially O(number of later days). Consider a normalized append-only ledger with bounded reconciled summaries.
2. **High: unbounded settlement allocations and KYC history.** Bound transaction batches and evaluate indexed append-only event collections. Do not truncate existing history.
3. **Medium: mixed money formats.** Legacy major-unit Number fields coexist with minor-unit custody/settlement fields. Current checks/converters agree; every new feature must reuse them. No silent historical conversion or rounding changes.
4. **Medium: customer/employee numbering.** Helpers read the highest code and increment in application code; simultaneous creates can collide and rely on unique-index rejection. Loan/receipt counters are stronger. Consider atomic onboarding sequences separately.
5. **High: runtime DDL.** Settlement ensureIndexes calls createCollection/createIndexes; other services use model.init(). Move index deployment to controlled release tooling before restricting runtime permissions.
6. **Medium: audit tamper resistance.** Application append conventions are not an independently protected ledger; atlasAdmin can alter history. Separate permissions and protected audit archives are needed.

## 7. Performance and indexing

Declared indexes for **existing** collections matched live metadata in this comparison. Only the two absent signature/approval collections lack their declared indexes. No exact duplicate index key/options were found.

There are **14 prefix-overlap candidate pairs**, not fourteen proven removable indexes. Some smaller indexes appear in more than one pair. Review workload, uniqueness, sort directions, collation and partial filters before changing any index; no index was modified.

| Collection | Smaller candidate | Prefix-covering index |
|---|---|---|
| activitytimelines | `entityType_1` | `entityType_1_entityId_1_createdAt_-1` |
| auditlogs | `module_1` | `module_1_referenceId_1_createdAt_1` |
| collections | `customerId_1` | `customerId_1_paymentDate_1` |
| collections | `customerId_1` | `portfolio_customer_receipts` |
| collections | `paymentDate_1` | `dashboard_receipt_period` |
| collections | `employeeId_1` | `employeeId_1_paymentDate_-1` |
| collections | `employeeId_1` | `employeeId_1_paymentDate_1` |
| customers | `employeeId_1` | `employeeId_1_status_1` |
| customers | `city_1` | `city_1_area_1` |
| loans | `customerId_1` | `portfolio_customer_loans` |
| loans | `employeeId_1` | `employeeId_1_status_1` |
| loanschedules | `loanId_1` | `portfolio_loan_due_dates` |
| loanschedules | `status_1` | `status_1_date_1` |
| overduefollowups | `loanId_1` | `loanId_1_followUpDate_-1_createdAt_-1__id_-1` |

Three simplified representative queryPlanner-only explains selected IXSCAN: customer directory -> portfolio_owner_name; date listing -> date_1; employee receipts -> employeeId_1_paymentDate_-1. These do not establish full aggregation latency, real index utilization or performance at scale. No load/executionStats benchmark was run.

Source-level bottlenecks:

- **High:** collectionPerformance.service.js reads all scoped loans, schedules and receipts before slicing results; Admin can read all payment history. Move date-aware aggregation/pagination toward MongoDB or reconciled read models without breaking backdated/advance semantics.
- **High:** audit dispatch polls every two seconds; each SSE client also polls, and email dispatch runs every thirty seconds. Multiple processes multiply the work. Prefer indexed incremental watermarks and coordinated workers/queues, keeping durable deduplication and role scoping.
- **Medium:** customer portfolios have server-side paging and batched enrichment. Global totals and sorting on computed metrics still do nested lookups before paging; derived summary caching needs reconciliation/invalidation design.
- **Medium:** installment includeSummary runs four extra aggregations. Loan collection history is unpaginated. Risk assessment batches queries rather than querying each customer individually, but fetches unbounded histories and retains analysis snapshots by actor/date/input.
- **Medium:** KYC PDF creation decodes files and builds a complete artifact in memory. Bound concurrent requests, memory and final size; never publicly cache private files.
- **Medium:** joined substring/regex filters and deep skip pagination can become expensive. Existing collation-aware prefix indexes help directory searches. Consider cursor pagination for long audit/receipt histories.
- Profile audit action/date dispatch, settlement status/date and allocation-reference shapes before adding tailored indexes. Preserve financial unique constraints; speculative indexes increase quota and write cost.

db.js supplies no explicit pool/wait/selection timeout budget. The driver's normal maxPoolSize default is 100 unless URI/options override it; the running server's effective pool configuration was not interrogated. Set per-process budgets and monitor total workers/app instances. The audit's two-connection pool is separate. [MongoDB Node client pool configuration](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/)

## 8. Backup and security findings

Five encrypted local backup sets have readable manifests and all expected archive/key/configuration files present:

| Backup date UTC | Collections | Documents | Missing expected archives |
|---|---:|---:|---:|
| 2026-10-23 | 22 | 435 | 0 |
| 2026-10-23 | 22 | 58 | 0 |
| 2026-10-26 | 22 | 143 | 0 |
| 2026-10-26 | 25 | 161 | 0 |
| 2026-10-27 | 28 | 198 | 0 |

The format records AES-256-GCM encrypted gzipped raw BSON, index/collection metadata and a consistent document snapshot. Historical manifests assert decrypt/hash/BSON verification; **this audit did not freshly decrypt/revalidate or restore them**. Newest is **27 October 2026**, about eleven days old, with 28 collections versus today's 35. It cannot recover subsequent changes. These manually named tmp scripts are not evidence of automatic scheduling or an off-site copy. Current recoverability is **NOT VERIFIED**.

Specialized current Atlas documentation describes an optional, gradually rolled-out **private-preview Free-cluster backup subscription**, taking daily snapshots and retaining four snapshots. Availability and enablement for this account are **NOT VERIFIED**. Check Atlas -> cluster -> Backup for actual status/snapshots; do not assume Free includes enabled backups. [Free backup availability and limitations](https://www.mongodb.com/docs/atlas/backup/cloud-backup/free-cluster-backup/)

Local key/config wrappers use Windows CurrentUser DPAPI: useful protection, but recovery depends on that Windows identity/machine. Keep separate protected portable key escrow and encrypted off-device backups. Agree RPO/RTO/retention, automate verified backups, and restore into an isolated environment to validate document decryption and financial reconciliation. Production point-in-time recovery objectives require a tier/service that actually supplies them; daily snapshots cannot provide minute-level recovery. Do not test restoration over the working database.

| Priority | Finding | Evidence and recommendation |
|---|---|---|
| Critical before production | Runtime database privilege is excessive | connectionStatus showed atlasAdmin on admin, including destructive/DDL actions. Split scoped runtime, read-only audit and migration/backup identities through an authorized rollout. |
| Critical before production | Current recovery capability not established | Local backups are dated; automatic Atlas status, off-site copy and restore drill unverified. Establish before real financial operation. |
| High | Development JWT secret is short | Present but shorter than 32 characters; length does not prove entropy. Use a strong generated production secret, planned rotation/session invalidation and explicit issuer/audience/algorithm policy. Current tokens expire after seven days and authVersion supports revocation. No value exposed. |
| High | Login credential annotation in .env | One comment contains a password label/value. Remove unnecessary human login credentials through an authorized change; no credential was copied into audit evidence. |
| High | Development deployment configuration | NODE_ENV is not production and FRONTEND_URL is not public HTTPS. Review public API TLS, network access, trusted origins and protected deployment secrets before launch. |
| High | Generic logging lacks systematic redaction | Logger stores error.message/stack and originalUrl. Query parameters/duplicate-key values can expose PII. Narrow local scan found zero URI/token-pattern lines but one duplicate-key line; this is not proof of no PII. Add source redaction, rotation/access controls. |
| Medium | Broad CORS and incomplete per-route throttling | app.js uses cors() without a trusted-origin list. Auth/some photo routes have limits; KYC/PDF has no dedicated actor limiter. Add production budgets; CORS does not authorize native clients. |
| Medium | Key/environment controls partly unverified | Encryption-key format valid, .env untracked/ignored, TLS validation enabled, test routes disabled. OS ACLs, secret manager, Atlas network allowlist, provider at-rest settings, key escrow and rotation not independently verified. |

Local access/error logs occupy ~12.94 / 0.44 MiB respectively, outside MongoDB quota. Binary encryption is positive but does not replace database/network/backup access controls. No password, token, OTP, URI, key, document or individual account detail was printed.

## 9. Android/iPhone and concurrent employee readiness

The existing authenticated Express API can serve Admin/Employee web and future native clients. Native apps must never embed the database URI/encryption key or connect directly to Atlas. Server-derived identity, active-account/ownership checks, exact installment allocation, transaction boundaries and durable idempotency are appropriate foundations.

Keep one stable idempotency key per payment/settlement intent across retries/devices. Show uncertain outcomes and query existing receipt/status before retrying. A different key is a different intent: a repeated amount alone cannot prove the same physical cash was recorded twice. Preserve separate customer review/company settlement evidence. Validate representative concurrency on isolated data before launch.

Use Android Keystore/iOS Keychain for tokens, HTTPS, scoped API requests and reviewed refresh/re-authentication. Add offline posting only with durable intent keys and a conflict/reconciliation design. SSE can update connected clients; background mobile delivery requires a scoped push design. Never push unnecessary private document/financial content.

Customer count is not concurrent capacity. Multiple writes per payment, M0 throughput, cashbook contention, all-history reports, polling and PDF memory can limit capacity before storage. No device, failover, sustained-load or recovery benchmark was run. A storage upgrade alone does not resolve these findings.

## 10. Prioritized action plan and checks

| Priority | Action | Acceptance evidence |
|---|---|---|
| Critical | Split overprivileged DB identities | Authorized rollout; normal operations work; runtime cannot perform unnecessary destructive/DDL operations |
| Critical | Current off-site encrypted backups and key recovery | Recent automated backup, separate recoverable key custody, successful isolated restore/reconciliation |
| High | Production secrets, HTTPS and network/origin controls | Reviewed rotation/revocation and deployment security checks |
| High | Bound generated PDFs/BSON and plan private artifact storage | Maximum-size isolated tests; immutable originals and signed outputs remain privately retrievable |
| High | Bound reports and coordinate notification workers | Representative isolated latency/throughput/memory evidence with unchanged totals/deduplication |
| High | Plan M0 exit before pressure | Weekly growth and quota/connection/ops alerts; tested upgrade/storage rollout |
| Medium | Cashbook/history/batch growth design | Auditable concurrency tests; no historical balance rewrite |
| Medium | Review index candidates | Planner/workload evidence, controlled deployment/rollback; preserve unique financial constraints |
| Medium | Log redaction/retention, pool and API/PDF budgets | Privacy checks and bounded resource usage with useful retry behavior |
| Low | Aggregate storage/adoption monitoring | File/PDF averages and updated forecasts without personal information |

Executed verification:

- PASS: connection/ping, database stats, 35 collection stats/BSON aggregates, 140 index definitions.
- PASS: KYC size/type/digest checks; populated references and selected duplicate financial keys.
- PASS: bounded allocation/loan/custody/settlement/cashbook consistency checks listed above.
- PASS: three representative queryPlanner explains; disconnected model/index comparison.
- PASS: static syntax check of **192 backend JavaScript source files**, zero failures.
- PASS: existing frontend **npm run lint**.
- NOT VERIFIED: Atlas control-plane tier/backup/network settings, fresh backup recovery, key ACL/escrow, other DB storage, sustained production load and native-device behavior.

Only this report and local audit helpers/aggregate evidence were created. Evidence files: tmp/mongodb-audit/measurements.json, integrity.json, index-review.json, query-plans.json and local-security.json. No application implementation or database objects were changed.
