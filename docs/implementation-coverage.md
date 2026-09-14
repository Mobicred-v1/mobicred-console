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

| Workspace | Current implementation | Boundary / remaining work |
|---|---|---|
| Overview | Authorized case snapshot and operational navigation | Not a financial ledger or a comprehensive live health dashboard |
| Investigation inbox | Persisted create, search, pagination, assignment, notes, resolve/reopen; global and partner/environment views | Versioned, idempotent and transactionally audited; owner slices may remain unavailable |
| Customers | Customer investigation design; native partner-linked customer references are available in each partner workspace | General customer search and full authoritative customer/account profiles remain unconnected |
| Payments | Source-state comparison and reconciliation design | Scoped owner reads and governed financial recovery remain unconnected; no force-success or balance edits |
| Credit & risk | Optional delegated Credit Intelligence read adapter | Owner authorization and selected-context verification required; no approval/disbursement shortcut |
| Partners | Native partner search/profile, create with first environment and policy, add environment, issue/rotate/revoke credentials, customer links and IP/scope policy display | Requires deployed Core staff contract/migration and CONSOLE_CORE_URL; Core owns all partner records; existing policy editing, usage/billing/webhook administration are not added |
| Data ingestion | Optional source-quality reads with counts, consent, trust, activity and snapshot freshness | Scoped owner verification; no raw payload browsing or reprocessing command |
| Aliases | Mapping and consistency design | Staff owner contract remains unconnected |
| Operations | Effective adapter policy and readiness configuration | Not an actual owner health probe; recovery commands and technical tool integrations remain unconnected |
| Configuration | Read-only effective console flags, configured state and current permissions | No arbitrary secret/env editor or mutable owner configuration |
| Approvals | Review, requester and approver design | Cross-service maker-checker execution contract remains unconnected |
| People & access | Verified current identity, roles, expiry and working context | Full staff/agency directory, provisioning and role-grant workflows remain unconnected |
| Audit | Persisted case audit feed with global/selected-context filtering | Partner command receipts remain Core-owned; a unified cross-service audit archive/UI is not yet connected |
| Reports | Persisted investigation workload reporting in current scope | Financial reporting and audited bulk exports remain unconnected |

## Deployment and upgrade

The root Docker Compose stack retains one Coolify resource for web, API and
persistent PostgreSQL. CONSOLE_PUBLIC_ORIGIN is explicit and the latest origin fix
is preserved. The console migration revokes obsolete sessions without discarding
historical operational records. Existing keys and volumes must be retained.

Deploying Console does not deploy or migrate Core. Core's new partner-workspace
contract must be released separately, using the existing staff issuer and compatible
audience/roles. Main/staging release divergence in another repository must be
reviewed rather than silently overwritten. See `platform-staff-and-partners.md`.

All feature/fix PRs target develop; promotions proceed develop -> staging -> main
with current-candidate checks and merge commits. No source change alone asserts
that a live service, production credential or customer record has been modified.
