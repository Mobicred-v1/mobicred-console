# Mobicred Console

The internal Mobicred staff workspace for investigations, partner administration
and platform operations. Mobicred owns the platform; partners are optional working
context, not separate console login identities.

## Staff sign-in and working context

Sign in once with an authorized staff identity. No tenant field or tenant claim is
required. The initial workspace covers all partners, subject to operation-specific
staff permissions. Select a verified partner and API environment after sign-in to
focus your work; return to all partners without signing in again.

A global server-side session boundary protects pages, nested routes, RSC/prefetch
requests and browser API routes before rendering. Backend guards independently
verify identity. Missing, forged, expired or revoked sessions are denied; identity
outages fail closed. Already-open tabs lock or reauthenticate when their session
expires or becomes unavailable. See [staff and partner operations](docs/platform-staff-and-partners.md).

## Deploy once in Coolify

Create one Git-based Application from this repository. Select branch **main**, the
**Docker Compose** build pack, Base Directory **/** and Compose Location
**/docker-compose.yml**. Set a public HTTPS domain on **web only**, targeting its
internal port **3006**. Set **CONSOLE_PUBLIC_ORIGIN** explicitly to the browser's
HTTPS origin, without the internal container port.

Supply the existing staff issuer, confidential client secret, matching audience
and explicit staff roles. Keep the generated database password and independent
session/login encryption keys stable across redeployments. The stack contains
**web + API + PostgreSQL** with persistent storage, readiness checks and serialized
automatic console migrations. Do not create separate application/database resources
or use Docker Compose Empty for these source-built images.

See [the Coolify setup](docs/coolify.md). No deployed environment or live identity
configuration is created merely by merging source code.

## Native partner administration

Set **CONSOLE_CORE_URL** to the Core HTTPS origin hosting the staff partner-workspace
contract. The console delegates the verified staff token, never a general-purpose
internal API key. Core remains authoritative for partners, environments, access
policies, credentials and customer references.

The partner workspace implements native partner creation with a first environment
and access policy, additional environments, credential issuance/rotation/revocation,
credential metadata, and paginated partner customer connections. API secrets are
shown once and are not stored in browser storage, receipts or audit metadata.

Core's staff contract and database migration must be deployed separately before
those features are operational. ADMIN/OPS can read and onboard; ADMIN is required
for credential operations. External partners use their own API credentials, not
this staff console. Missing owner contracts produce explicit unavailable states.

## Applications and data ownership

- `apps/web`: responsive staff UI, port 3006.
- `apps/api`: staff backend-for-frontend and investigation workflows, port 3005.
- PostgreSQL: console sessions, optional context, cases, notes and audit receipts.

The console does not own banking balances, provider payment state, credit scores
or loan execution. See [implementation coverage](docs/implementation-coverage.md)
for connected features, deliberate limits and remaining integrations.

## Local design preview

```sh
bun install --frozen-lockfile
CONSOLE_ENV=preview CONSOLE_PREVIEW_ENABLED=true bun run --cwd apps/web dev
```

Open `/preview/overview`. Every fixture is synthetic. Preview actions do not call
owner services. Both switches are required; production preview requests return 404.
Never set CONSOLE_ENV=preview on the production resource.

## Checks and delivery

```sh
node --test deploy/runtime-config.spec.cjs
bun run --cwd apps/api build
bun run --cwd apps/api test --runInBand
bun test tests
bun run --cwd apps/web build
bun run --cwd apps/web lint
```

GitHub Actions also exercise real temporary PostgreSQL databases, protected-page
and authenticated partner journeys, desktop/mobile layouts, and actual Docker
Compose startup/persistence. Identity and owner fixtures are isolated test systems,
not proof of production connectivity.

Feature/fix PRs -> **develop** -> **staging** -> **main**, with current-candidate
checks at every promotion and merge commits preserving ancestry. See `AGENTS.md`
and `docs/release-flow.md`. Keep existing data volumes and encryption keys when
redeploying; take tested backups before applying production migrations.
