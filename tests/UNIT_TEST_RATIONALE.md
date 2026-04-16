# Backend Unit Test Rationale

## Auth
- `sendOtp` invalid-role test: blocks role escalation attempts.
- `sendOtp` duplicate-verified-user test: blocks account duplication/takeover by email reuse.
- `verifyOtp` expiry test: blocks OTP replay after timeout.
- `signup` employer approval-state test: enforces moderation gate, blocks unapproved access.

## Payments
- `createOrder` amount validation test: blocks zero/negative payment tampering.
- `verifyPayment` missing-fields test: blocks malformed verification payload abuse.
- `verifyPayment` invalid-signature test: blocks forged webhook/client verification attempts.
- `verifyPayment` valid-signature + subscription-upgrade test: ensures post-payment state integrity.

## Job Pricing
- `getFeePreview` invalid-budget test: blocks fee bypass through invalid pricing input.
- `getFeePreview` rate math test: prevents under/overcharging from fee logic regressions.
- `createJobListing` required-fields test: blocks malformed job records.
- `createJobListing` computed-fee persistence test: protects financial consistency and auditability.

## Quiz Anti-Cheat
- `reportViolation` auto-terminate test: enforces anti-cheat threshold consistently.
- `submitAttempt` timeout test: blocks client-side timer bypass and late submissions.
