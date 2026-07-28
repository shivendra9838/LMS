# LMS Admin Dashboard Documentation

## 1. Overview
The Admin Dashboard serves as the executive command center for the LMS, aggregating real-time portfolio metrics, daily operational telemetry, and visual analytics via `recharts`.

---

## 2. Dashboard Sections & UI Layout

### A. Top KPI Cards
- **Total Employees**: Total staff registered (`Active` vs Total).
- **Total Customers**: Total customer accounts (`Active` vs Total).
- **Total Loans**: Master portfolio overview (`Active` vs `Completed`).
- **Total Outstanding**: Sum of remaining principal across all active loans (₹).
- **Monthly Revenue**: Month-to-date collection revenue (₹).
- **Collection Efficiency**: System-wide efficiency percentage.

### B. Today's Pulse
- **Today's Collections**: Total count of installments collected today.
- **Today's Pending**: Total count of installments due but uncollected.
- **Today's Missed**: Total count of installments explicitly marked missed or flagged by 9 PM EOD enforcer.
- **Today's Revenue**: Total monetary revenue collected today (₹).
- **Average Collection**: Mean revenue per collection transaction today (₹).

### C. Analytics Suite (`recharts`)
- **Pie Chart**: Visual breakdown of Today's Schedule Status (`Paid`, `Pending`, `Missed`).
- **Line Chart**: 30-day historical trend of daily collection amounts.
- **Bar Chart**: Ranking of employee performance based on collection efficiency.
- **Area Chart**: Comparison of Area-wise total outstanding vs today's collections.

---

## 3. KPI Definitions

| KPI Name | Definition / Calculation | Source Collection |
| :--- | :--- | :--- |
| **Total Outstanding** | `SUM(remainingAmount)` where `status == 'ACTIVE'` | `loans` |
| **Today's Revenue** | `SUM(amountReceived)` where `paymentDate >= startOfDay` | `collections` |
| **Monthly Revenue** | `SUM(amountReceived)` where `paymentDate >= startOfMonth` | `collections` |
| **Average Collection** | `Today's Revenue / Today's Payment Count` | `collections` |
| **Collection Efficiency** | `(Today's Revenue / Today's Total Due Amount) * 100` | `loanschedules` & `collections` |

---

## 4. Redis Caching Strategy

To ensure instant load times under high data volume (500k+ collections), the dashboard employs a Redis caching layer:
- **Cache Key**: `admin_dashboard_stats`
- **TTL (Time to Live)**: 300 seconds (5 minutes)
- **Fallback**: Gracefully falls back to MongoDB aggregation if Redis server is unreachable.

---

## 5. Performance SLAs
- **Target SLA**: < 2.0 seconds load time.
- **Achieved Benchmark**: **~885 ms** (Passing SLA ✅).
