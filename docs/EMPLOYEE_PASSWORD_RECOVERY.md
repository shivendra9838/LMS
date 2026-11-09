Employee login includes Reset (clears the form), Forgot password, and a one-time email reset flow. Employees can choose or generate a strong password on the reset page. Existing Admin password reset remains available.

Gmail setup:
1. Copy the fields from `backend/.env.email.example` into your existing `backend/.env`, preserving all existing keys.
2. Set SMTP_USER and SMTP_FROM to your sending Gmail address.
3. Enable Google 2-Step Verification and create an App Password for this application. Enter it as SMTP_PASS locally. Do not use your normal Google password or share the App Password in chat.
4. Set FRONTEND_URL to the exact frontend origin. Local testing can use http://localhost:5173; deployed applications require HTTPS. A localhost email link works only on the computer running the LMS.
5. Restart the backend. Open Employee login → Forgot password and request an email for a controlled employee account. Check spam as well as inbox. Workspace organizations may restrict App Passwords; consult the account administrator if unavailable.

POST /api/v1/auth/employee/forgot-password accepts email. The response is identical for known, unknown and inactive accounts. Missing SMTP configuration returns 503 instead of claiming delivery. Delivery failures are logged without SMTP credentials, recipient address or reset link.

POST /api/v1/auth/employee/reset-password accepts token, password and confirmPassword. Tokens contain 256 random bits, are stored only as SHA-256 hashes, expire in 15 minutes and are consumed atomically with the password update. New requests replace older links, with a persistent per-account 60-second cooldown. Each IP is limited to 10 recovery requests per 15 minutes (shared between the two endpoints, in-memory per server process; multi-instance deployments need a shared limiter store). Only active Employee accounts are eligible.

Reset links use a URL fragment, excluded from server access logs and HTTP referrers; the frontend removes the fragment after loading. Employee documents add private passwordReset and authVersion fields. Existing employee JWTs are revoked after a successful reset; Admin sessions are unaffected. Passwords are bcrypt-hashed, 12–64 characters, at most 72 UTF-8 bytes, with uppercase, lowercase, number and symbol required. Generated passwords use browser cryptographic randomness. No password or token is stored in browser storage by the recovery form.

The backend sends emails asynchronously after the generic acceptance response. This response is not a delivery receipt. If the process stops during delivery, request another link after the cooldown. Production deployments requiring guaranteed delivery should use a durable mail queue. SMTP credentials and actual mailbox delivery must be verified by the operator; automated tests use a mocked SMTP transport and disposable MongoDB only.
