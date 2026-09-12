# Audited investigation workflows

This change enables only Console-owned case operations. It does not change Core
customer status, money movement, scores, Fineract records or partner credentials.

## Configuration

Run the registered migration through the controlled migration rollout. Set:

- CONSOLE_CASE_WORKFLOWS_ENABLED=true
- CONSOLE_CASE_WRITE_ROLES: explicit staff roles allowed to create and update cases
- CONSOLE_AUDIT_READ_ROLES: explicit staff roles allowed to read the case audit feed
- CONSOLE_CASE_REPORT_ROLES: explicit roles allowed to read case workload reports

All flags/role lists default closed. Tenant and actor are derived only from the
verified session. Keep application and database migration credentials separate;
run database and application timezones in UTC. No production migrations were
executed by this PR.

## Supported operations

`GET /api/v1/console-cases` supports server-side tenant filtering, title/reference
search, status filtering and pagination. `GET /:id` includes version and the latest
100 immutable notes. A missing or foreign-tenant case returns the same 404.

`POST /api/v1/console-cases` creates a case and initial note. Mutations require a
UUID v4 Idempotency-Key. `POST /:id/commands` accepts only assign_to_me, add_note,
or set_status. A current expectedVersion and meaningful reason are mandatory.
Resolved cases must explicitly reopen to open before returning to waiting.
Assignment cannot specify a different actor: assign_to_me uses the verified staff
identity. There is no deletion or arbitrary record-update endpoint.

A database transaction commits the case change, note, audit record and receipt.
A failed audit insert rolls the whole command back. Advisory locks serialize
same-actor, same-tenant idempotency retries. Reusing a key with a different body
returns 409. Row locking and version checks prevent concurrent lost updates.

The browser sends only its HttpOnly session cookie to explicit Next.js routes.
Those routes verify the configured request origin, bound the request body and
forward a session identifier to the BFF; they do not inject privileged service
keys. Ambiguous network errors preserve the form's idempotency key for retries.

Audit records and notes reject ordinary SQL updates/deletes through triggers.
This is not protection against a privileged DBA changing schema or disabling
triggers. Immutable external archival, role-separated database grants, retention
and backup policies remain deployment responsibilities. Automatic downgrade is
intentionally refused because it would discard audit history.

## Reports and exports

Audit and reports workspaces can display live case audit records and tenant-wide
case workload counts. These are not financial reports. Production exports remain
disabled pending an audited export contract; preview exports stay synthetic.

## Verification

The Postgres integration workflow runs real schema migrations and HTTP requests
against an ephemeral database, with an explicitly mocked identity provider. It
tests concurrent idempotent creation, tenant isolation, stale-version conflicts,
read-only roles, audit-failure rollback, append-only enforcement, encrypted session
storage and logout. It does not use production secrets or databases.
