# Employee settlement accounting cards

Root cause: More Accounting Details reused the legacy Stat component with bg-white. Its secondary grid attempted to override that utility through a competing background rule; dark inherited text became unreadable. The employee section now renders semantic articles using the same ds-stat surface, border, typography and responsive rules as primary settlement metrics. Removed obsolete secondary div and Tailwind text selectors. Admin legacy rendering is unchanged.

Changed application files:
- frontend/src/components/settlements/SettlementPresentation.jsx
- frontend/src/components/settlements/daily-settlement.css
- frontend/src/pages/shared/DailySettlement.jsx
- frontend/tests/settlementPresentation.test.mjs

Verification: lint and production build passed. Regression test covers all six labels, zero, nonzero and negative minor-unit values and shared dark card markup. Browser verification used the actual page and PortalShell with a read-only synthetic Axios adapter, without a database connection. Widths 320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920 passed document and card overflow checks. All six amounts computed off-white rgb(245,248,250), labels rgb(212,224,231), backgrounds the existing navy gradient. Accordion click and keyboard collapse/reopen passed. No browser console errors. Laptop/mobile/desktop screenshots saved under tmp/settlement-card-fix. Real Android/iOS device testing was not performed.

No backend, calculations, permissions, labels, logo assets or database records changed. Existing uncommitted work preserved.
