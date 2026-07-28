# LMS Excel Export System Documentation

## 1. Overview
The Excel Export module provides automated, formatted `.xlsx` generation for all system reports and data entities using `ExcelJS`. Exports stream directly to HTTP client responses with appropriate MIME headers.

---

## 2. Export Endpoints & Supported Types

### Endpoint
`GET /api/reports/export/:type`

### Supported Types
1. `daily`: Exports daily collection records with expected vs received amounts.
2. `monthly`: Exports monthly revenue records.
3. `collections`: Exports payment transaction log with channel details (Cash, UPI, etc.).
4. `outstanding`: Exports all active loans sorted by highest remaining balance.
5. `loans`: Exports master loan ledger.
6. `customers`: Exports customer registry with contact and area information.
7. `employees`: Exports employee directory and performance summaries.

---

## 3. Formatting & Serialization Rules

### A. Header Formatting
- Keys are automatically converted from camelCase to Title Case with spaces (e.g. `loanNumber` → `Loan Number`, `amountReceived` → `Amount Received`).
- Default column width set to `20` units for clear readability.

### B. Date Normalization
- All `Date` instances are stripped of ISO time strings and formatted cleanly as `YYYY-MM-DD`.

### C. Numeric Rounding
- All floating-point numeric values (amounts, percentages, balances) are rounded to **2 decimal places** (`Math.round(val * 100) / 100`).

### D. Empty Dataset Fallback
- If a query yields zero rows, the spreadsheet is generated with a single column header `'No Data'` to prevent client parsing errors.

---

## 4. File Naming Conventions
Files are delivered as dynamic HTTP attachments using the following naming structure:
- Example: `daily-report-2026-07-28.xlsx`
- Headers set:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename=<filename>.xlsx`

---

## 5. Pipeline & Performance Optimizations
- **Pipeline Order**: In MongoDB aggregations, `{ $sort }` stages are executed *before* `$lookup` and `$project` stages to leverage index scans and prevent 32MB in-memory sort errors.
- **Performance Expectation**: < 15.0 seconds target SLA for large datasets.
