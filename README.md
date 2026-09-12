# Mobicred Console

An internal operations workspace for customer investigations, payments, credit,
partners and platform governance. The console does not own banking balances,
payment-provider state, scores or lending execution.

## Applications

- `apps/web`: Next.js responsive console, port 3006.
- `apps/api`: NestJS staff BFF and investigation workflows, port 3005.
- PostgreSQL: console-owned cases, notes, audit receipts and encrypted sessions.

## Design preview

```sh
bun install --frozen-lockfile
CONSOLE_ENV=preview CONSOLE_PREVIEW_ENABLED=true bun run --cwd apps/web dev
```

Open `/preview/overview` on the web application. All preview identities, amounts,
service statuses and case records are synthetic. Preview actions never call owner
services. Both preview switches are required; production preview routes return
404. Do not configure a real production deployment with CONSOLE_ENV=preview.

The fourteen workspaces are overview, investigation inbox, customers, payments,
credit and risk, partners, data ingestion, aliases, operations, configuration,
approvals, people and access, audit, and reports. Tables, filters, search, detail
views, keyboard navigation and mobile layouts are implemented.

## Authenticated operation

Read `docs/live-integration.md` for the Keycloak confidential client, S256 PKCE,
exact redirect URI, verified tenant/role claims, server-side sessions, encryption
keys and controlled database migrations. No access token is stored in browser
localStorage or sessionStorage. Identity outages fail closed.

Read `docs/case-workflows.md` to enable case creation, assignment, notes,
resolution and reopening. These commands require configured write roles, a
reason, idempotency key and current version. Case state, audit and receipt commit
atomically. Other owner-service writes remain disabled.

## Coverage is explicit

`docs/implementation-coverage.md` separates completed visual workspaces from
available live integrations. This series implements live case operations, the
case audit feed and workload reports, plus an optional scoped credit read adapter.
Customer, payment, partner, alias, configuration and staff-directory owner
integrations still require their permission-scoped contracts. Missing sources
show unavailable states; preview fixtures are never a production fallback.

## Checks

```sh
bun run --cwd apps/api build
bun run --cwd apps/api test --runInBand
bun test tests
bun run --cwd apps/web build
bun run --cwd apps/web lint
```

GitHub Actions additionally run all fourteen workspaces at desktop and mobile
sizes, a real PostgreSQL transaction/isolation suite, and an authenticated browser
journey against compiled application servers and an isolated test identity
provider. The latter validates the code flow but is not proof of production
Keycloak or production owner-service configuration.

## Review order

The implementation is split into stacked PRs: security foundation, complete UI,
authenticated integration, then audited case workflows. Merge in that order and
validate the configured integration in staging before any production rollout.
No PR automatically deploys the application or alters production services.
