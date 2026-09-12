# Console implementation coverage

All fourteen visual workspaces are represented. Visual coverage is not a claim
that every owner service already exposes a safe staff API. Live integrations
below describe implemented code; production connectivity requires deployment
configuration and has not been verified by fixture-based CI.

| Workspace | Implemented UI | Implemented live integration / boundary |
|---|---|---|
| Overview | Cases, attention queue, source health, module navigation | Authorized recent case snapshot; unconnected service health remains not observed |
| Investigation inbox | Search, filters, pagination, detail, notes, create/assign/resolve/reopen | Postgres-backed, versioned, idempotent and transactionally audited case commands |
| Customers | Customer context, accounts, KYC, activity, related records | Tenant-scoped owner staff contract still required; unscoped customer search is not connected |
| Payments | Source-by-source states, references, timeline, reconciliation context | Scoped owner contract still required; no unsafe retry or force-success command |
| Credit & risk | Score, model, evidence and execution boundary | Optional scoped Credit Intelligence admin-search adapter with bounded read transport |
| Partners | Tenant, credential metadata and access-policy preview | Complete scoped inventory/credential lifecycle contract still required |
| Data ingestion | Searchable source quality, historical counts, consent, trust, activity and freshness | Optional existing Credit Intelligence source-quality adapter; verified tenant query and every row checked; no reprocessing or raw payloads |
| Aliases | Directory and mapping consistency preview | Owner staff contract still required |
| Operations | Effective adapter policy/readiness cards; specialist-tool preview | Console capability metadata only. Reachability remains untested; detailed owner health/recovery and tool links still required |
| Configuration | Effective console gates, configured state and current-session permissions | Read-only console capability policy; secrets/origins excluded; mutable owner configuration still unconnected |
| Approvals | Intent, before/after, requester/approver boundary preview | Owner-enforced approval and execution contracts still required |
| People & access | Current identity, tenant, roles, expiry and effective permissions | Verified current staff session only; full staff/agency directory is not connected |
| Audit | Filterable records and case links | Append-only case-mutation audit feed; not yet a cross-service audit archive |
| Reports | Report scopes and metadata | Tenant-wide investigation workload counts; financial reports and audited exports not connected |

## Delivery order

Feature and fix PRs merge only into develop. Promote develop into staging through
a checked PR, then staging into main through another checked PR. Preserve history
with merge commits. See AGENTS.md and docs/release-flow.md.

## Runtime setup

Do not deploy preview mode as production. Configure real HTTPS origins,
Keycloak protocol mappers, role grants, encryption keys and database migrations
before enabling workflows. See docs/ingestion-integration.md for source-quality
reads. No production credentials or private infrastructure addresses are included
in this repository. CI identities and data are isolated, explicitly synthetic fixtures.
