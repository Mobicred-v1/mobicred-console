# Console implementation coverage

The fourteen workspaces are represented visually. The table distinguishes actual
code integration from absent owner contracts. Tests use isolated identities and
owner fixtures; a green build is not evidence of a live production deployment.

## Cross-cutting implementation

Platform-wide Mobicred staff sign-in has no tenant input or tenant claim requirement.
A global verified-session boundary protects pages, record paths, RSC and browser
APIs, with independent backend authorization. Working context is optional after
sign-in, persisted as partner + API environment with a context version. Stale forms
cannot silently execute in a new context. Staff-facing identity language is neutral.

Staff identity, optional operational filter and explicit administration target are
separate. `/partners` always opens the global directory; `/partners/:code` administers
that explicit partner and its environments. Neither route inherits a hidden target
from the current operational filter. Onboarding remains accessible with a selected
partner. The filter stays unchanged when administering another partner. Owner role
and target authorization remain mandatory. See `ops-administration.md`.

| Workspace | Current implementation | Boundary / remaining work |
|---|---|---|
| Overview | Operations-first home with real recent cases, working investigation creation link, partner onboarding and directory entry points, optional scope control | Not a financial ledger or a comprehensive live health dashboard |
| Investigation inbox | Persisted create, search, pagination, assignment, notes, resolve/reopen; global and partner/environment views | Versioned, idempotent and transactionally audited; owner slices may remain unavailable |
| Customers | Customer investigation design; native partner-linked customer references are available in each partner administration page | General customer search and full authoritative customer/account profiles remain unconnected |
| Payments | Source-state comparison and reconciliation design | Scoped owner reads and governed financial recovery remain unconnected; no force-success or balance edits |
| Credit & risk | Optional delegated Credit Intelligence read adapter | Owner authorization and selected-context verification required; no approval/disbursement shortcut |
| Partners | Global directory/profile, onboarding with first environment and policy, additional environments, explicit credential issue/rotate/revoke targets, all-environment partner customer links and IP/scope policy display | Requires deployed Core staff contract/migration and CONSOLE_CORE_URL; Core owns all records; existing policy editing, usage/billing/webhook administration are not added |
| Data ingestion | Optional source-quality reads with counts, consent, trust, activity and snapshot freshness | Scoped owner verification; no raw payload browsing or reprocessing command |
| Aliases | Mapping and consistency design | Staff owner contract remains unconnected |
| Operations | Effective adapter policy and readiness configuration | Not an actual owner health probe; recovery commands and technical tool integrations remain unconnected |
| Configuration | Read-only effective console flags, configured state and current permissions | No arbitrary secret/env editor or mutable owner configuration |
| Approvals | Review, requester and approver design | Cross-service maker-checker execution contract remains unconnected |
| People & access | Verified current identity, roles, expiry and working context | Full staff/agency directory, provisioning and role-grant workflows remain unconnected |
| Audit | Persisted case audit feed with global/selected-context filtering | Partner command receipts remain Core-owned; a unified cross-service audit archive/UI is not yet connected |
| Reports | Persisted investigation workload reporting in current scope | Financial reporting and audited bulk exports remain unconnected |

Console credential forms preserve existing expiry on rotation, validate expiry before
submission, and freeze every field after the first attempt. Retrying an uncertain
outcome reuses its exact serialized body and request key; it does not issue a second
credential. Scope directory pagination and an owner-outage-independent return to
all partners are implemented. Existing case isolation and session expiry protections
are unchanged.

## Deployment and upgrade

The root Docker Compose stack retains one Coolify resource for web, API and
persistent PostgreSQL. CONSOLE_PUBLIC_ORIGIN is explicit and the latest origin fix
is preserved. Existing keys and volumes must be retained. The operations-home and
administration correction adds no migration and requires no new identity grants.

User-confirmed deployment mapping: staging publishes staging-console.mobicred.net;
main publishes console.mobicred.net. A separate bounded, anonymous GET-only workflow
checks login/page/API boundaries on those hosts. Push observations wait for the new
platform-entry marker; this marker is not an exact commit attestation and does not
verify authenticated owner operations. Full staff and credential journeys run only
against the isolated test stack.

Deploying Console does not deploy or migrate Core. Core's partner-workspace
contract must be released separately, using the existing staff issuer and compatible
audience/roles. Main/staging release divergence in another repository must be
reviewed rather than silently overwritten. See `platform-staff-and-partners.md`.

All feature/fix PRs target develop; promotions proceed develop -> staging -> main
with current-candidate checks and merge commits. No source change alone asserts
that a live service, production credential or customer record has been modified.
