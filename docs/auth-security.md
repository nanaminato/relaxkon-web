# Authentication security administration

The administration workspace includes **Authentication security** at `/admin/auth-security`.
It uses the server's persisted single-instance policy and does not maintain browser-side counters.
Changes take effect on the server after a successful save, without a restart.

## Permissions and operations

Both a live administrator role and the dynamic `auth-security-management` feature grant are required.
The route guard is only a convenience; the server independently enforces authorization on every API call.
Administrators can edit login, anonymous endpoint, cooldown and bounded resource settings; inspect a
manually refreshed snapshot of recent failures, security events and restrictions; and clear a selected
restriction after confirmation. Clearing one restriction does not clear other dimensions.

The editor preserves a server revision and requires reload on a concurrent-update conflict. It does not
retry a mutation automatically after network errors. Monitoring refresh does not discard settings edits.
No security records, settings copies, passwords or tokens are added to browser persistence by this page.
Account identifiers in monitoring are one-way digests, not usernames. Existing authentication token
storage remains unchanged by this work. Temporary refresh failures (429, server errors and network
errors) no longer discard a valid local session; rejected tokens (401/403) still clear it.

## Defaults

- Login IP: 10 requests / 60 seconds.
- Account: 5 failures / 900 seconds, followed by a short 2-second verification interval.
- IP + account: 5 failures / 300 seconds; progressive cooldown starts at 30 seconds and caps at 900 seconds.
- Up to 10,000 counter entries, 8 concurrent login verifications, and 500 recent events.
- Anonymous window: 900 seconds; registration 30, email code 10, password reset 10, other verification 30 requests per IP.
- Refresh tokens: 60 requests per IP / 60 seconds.

Account pressure is not a permanent account lock. Correct passwords can still succeed at the next
admitted verification opportunity; IP and resource limits continue to apply. Counters reset when the
single server instance restarts. See the server documentation for enforcement, persistence and proxy trust.

The login page no longer requires the old client-only image-code comparison. That code was returned to
the browser with its image and was not a server-enforced security boundary. The compatibility verification
API remains on the server. No mandatory CAPTCHA is introduced. Login throttling shows a generic message
and the server's `Retry-After` seconds, without disclosing account existence.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm run test:i18n`, `npm run test:migration`, `npm run build`,
and `npm test -- --watch=false --browsers=ChromeHeadless` (with a suitable Chromium installation).
Focused tests cover policy bounds, revision conflicts, duplicate actions, explicit clear/cancel,
uncertain responses, monitoring failure, live authorization, API contracts and login throttling.

The existing `.github/workflows/ci.yml` runs the complete ChromeHeadless suite on every pull request,
in addition to type checking, lint, translation checks, migration checks and production build.
