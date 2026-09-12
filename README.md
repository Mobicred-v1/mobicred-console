# Mobicred Console

An internal operations workspace for customer investigations, payments, credit,
partners and platform governance. The console does not own banking balances,
payment-provider state, scores or lending execution.

## Deploy once in Coolify

Create **one Git-based Application** from this repository, choose the **Docker
Compose** build pack, branch **main**, Base Directory **/** and Compose Location
**/docker-compose.yml**. Set an HTTPS domain on **web only**, targeting internal
port **3006**. Enter your existing Keycloak staff issuer/client secret and explicit
staff roles. Coolify generates the database password and two encryption keys.

The stack builds and starts **web + API + PostgreSQL** with persistent database
storage, health checks, automatic serialized migrations and internal networking.
No separate database/application resources, public API domain, manual schema
initialization, or registry credentials are required. Application code stays in Git;
redeploy this same resource after future main promotions.

Read **[the one-time Coolify setup](docs/coolify.md)** for exact fields, Keycloak
callback/mappers, capability gates, backups and troubleshooting. Existing staff
identity is required; the stack does not create a new identity provider or bypass
login. Optional writes/owner reads remain explicitly permissioned and disabled
until enabled. Do not use Docker Compose Empty for this source-built stack.

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

`docs/implementation-coverage.md` separates visual workspaces from implemented
live integrations. Cases, case audit and workload reports are persisted. Optional
scoped credit/ingestion read adapters and effective-capability views are present.
Customer, payment, partner, alias, full staff-directory and mutable owner
configuration integrations still require their permission-scoped contracts.
Missing sources show unavailable states; preview fixtures are never a fallback.

## Checks

```sh
node --test deploy/runtime-config.spec.cjs
bun run --cwd apps/api build
bun run --cwd apps/api test --runInBand
bun test tests
bun run --cwd apps/web build
bun run --cwd apps/web lint
```

GitHub Actions also run desktop/mobile previews, PostgreSQL transaction/isolation,
authenticated fixture journeys and real Docker Compose image/startup/persistence
checks. Fixture verification is not proof of production Coolify, Keycloak or
owner-service configuration. See `docs/coolify.md` for the Compose test boundary.

## Delivery order

Feature/fix PRs -> **develop** -> **staging** -> **main**, with current-candidate
checks at each promotion. Preserve ancestry with merge commits. See `AGENTS.md`
and `docs/release-flow.md`. Coolify may deploy main after its Git webhook is
configured; merging a PR alone is not evidence that production has deployed.
