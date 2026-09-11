# Console implementation coverage

All fourteen visual workspaces are represented. Visual coverage is not a claim
that every owner service already exposes a safe staff API.

| Workspace | Implemented UI | Live integration in this series |
|---|---|---|
| Overview | Cases, attention queue, source health, module navigation | Authorized recent case snapshot; unconnected service health remains not observed |
| Investigation inbox | Search, filters, pagination, detail, notes, create/assign/resolve/reopen | Postgres-backed, versioned, idempotent and transactionally audited case commands |
| Customers | Customer context, accounts, KYC, activity, related records | Owner staff contract still required |
| Payments | Source-by-source states, references, timeline, reconciliation context | Owner staff contract still required; no unsafe retry or force-success command |
| Credit & risk | Score, model, evidence and execution boundary | Optional scoped Credit Intelligence admin-search adapter |
| Partners | Tenant, credential metadata and access-policy views | Complete scoped inventory/credential lifecycle contract still required |
| Data ingestion | Source, batch, lineage and quality views | Owner staff contract still required |
| Aliases | Directory and mapping consistency views | Owner staff contract still required |
| Operations | Service cards and specialist-tool inventory | Detailed health/recovery adapters and configured tool links still required |
| Configuration | Effective settings and proposed changes | Governed owner commands still required |
| Approvals | Intent, before/after, requester/approver boundary | Owner-enforced approval and execution contracts still required |
| People & access | Staff views and capability matrix | Current signed-in scope is live; full staff/agency directory is not connected |
| Audit | Filterable records and case links | Append-only case-mutation audit feed; not yet a cross-service audit archive |
| Reports | Report scopes and metadata | Tenant-wide investigation workload counts; financial reports and audited exports not connected |

## Review order

1. Security foundation: verified staff and tenant-scoped legacy reads.
2. Design implementation: complete responsive workspaces and isolated preview.
3. Authentication/integration: PKCE sessions, live reads and migration wiring.
4. Case workflows: durable Console-owned operations, audit and reporting.

Merge in order. Do not deploy preview mode as production. Configure real origins,
Keycloak protocol mappers, role grants, encryption keys and database migrations
before enabling live workflows. No secrets or private infrastructure addresses
are included in this public repository.
