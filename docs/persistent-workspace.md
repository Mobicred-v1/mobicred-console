# Persistent navigation and independent access states

## Root causes corrected

The previous authenticated pages each constructed their own ConsoleShell. A root
loading boundary replaced the whole interface while a different section loaded.
Links already used the Next router, but the chrome remount/loading made transitions
look like document reloads. Partner-context controls also used actual location.assign
and the per-page session boundary used location.reload for context changes.

The route group app/(workspace) now owns one authenticated layout. ConsoleFrame is
pure persistent chrome; StaffSessionProvider owns the session/expiry/revalidation
lifecycle; StaffView guards server data snapshots against stale context, identity or
role revisions. Pages render content, not another sidebar or another session guard.
The preview frame remains separate and explicitly non-production.

Workspace loading/error/not-found boundaries replace content only. Navigation uses
Next Link/history with pending indicators. Context changes use replace/refresh and
mask outdated page snapshots; no normal operation assigns a new document location.
A transition into actual authentication may still replace the document deliberately.
All server loaders authenticate independently of the cached/shared layout; proxy and
API authorization remain enabled. React cache deduplicates session resolution only
within a server render, never across staff requests or sessions.

## Audit and Reports

These routes are not alternative login surfaces. A missing session, a forbidden
capability, an unconfigured read-role gate, a missing record and an unavailable
source are distinct states. A valid session is retained for source failures.
No new read permission is implicitly granted: configure CONSOLE_AUDIT_READ_ROLES
and CONSOLE_CASE_REPORT_ROLES for the intended staff. Missing settings yield a typed
ACCESS_NOT_CONFIGURED response; non-matching roles yield ACCESS_DENIED. Authorized
requests still use the same scoped audit/report database predicates.

A missing collection endpoint cannot be represented as a live empty collection.
The only public upstream error metadata accepted by the web client is a small
allowlist of codes; raw backend bodies/messages never become UI diagnostics.

## Session behavior and modals

Routine focus/navigation/interval revalidation is background work and does not blank
an authorized screen or discard its form. A verified outage/denial locks or signs
out the user. Locking unmounts descendants, closes native modal top-layer state and
clears one-time secret displays, leaving Retry/Sign out usable. Restored/back-cached
views compare identity, roles, expiry and both partner/environment keys plus version.
Stale data is masked and revalidated without a document reload. Backend stale-command
checks remain mandatory independently of all client logic.

## Other corrected behavior

Partner validation errors (confirmed 400 rejection) allow editing again; uncertain
outcomes retain their exact frozen request/key. Multiline reason text is normalized
before submission to match Core's text contract. Inactive/unverified statuses cannot
be styled as active through substring matching. Empty successful reports display an
explicit empty state. No schema, secret, owner-service or identity configuration is
changed by this refactor.

## Verification and deployment

The new browser regression uses compiled applications, a temporary PostgreSQL
database and the isolated identity/owner fixtures. It clicks all fourteen menus,
asserts zero document navigation requests and identical sidebar/header DOM nodes,
checks history/context changes, authorized and denied Audit/Reports, a native modal
open during an outage, and revocation. Existing browser, Compose and database suites
remain enabled. API tests additionally cover missing role configuration without
turning it into an authentication failure.

Coolify deployment is manual: promote source through develop -> staging -> main,
then use Redeploy on the intended existing Compose resource. Deployed observations
are workflow_dispatch-only and inspect one selected environment after redeploy.
They are not a Git-push deployment gate. Never infer the running commit from a fixed
markup marker. This work does not operate the Coolify UI or change live records.
