# One Coolify resource for Mobicred Console

The repository builds one Git-based Docker Compose Application containing `web`,
`api` and `postgres`. It does not require separate frontend, API or database
resources. Do not choose Docker Compose Empty, which does not check out the source
needed by the root Dockerfile.

## Create once, then redeploy the same resource

| Setting | Value |
|---|---|
| Git repository | Mobicred-v1/mobicred-console |
| Branch | main |
| Build pack | Docker Compose |
| Base Directory | / |
| Docker Compose Location | /docker-compose.yml |
| Raw Compose Deployment | Off |
| Inject Build Args to Dockerfile | Off |
| Custom build/start commands | Empty |

Assign an HTTPS domain to **web only**. For example, the Coolify Domains entry
`https://console.your-domain.tld:3006` targets the internal web port 3006, while
visitors use `https://console.your-domain.tld`. Point DNS at the Coolify server.
Do not assign an API/database domain or publish their ports. Leave Connect To
Predefined Network off unless separately reviewed cross-resource networking is needed.

Set **CONSOLE_PUBLIC_ORIGIN explicitly** to the actual browser HTTPS origin,
without the internal :3006 port. The latest origin fix is retained: generated
SERVICE_URL_WEB_3006 metadata is not the application's security origin.

## Required staff identity configuration

Mobicred staff sign in once, globally. There is **no tenant field and no tenant
claim requirement**. Partner/environment context is selected after authentication.
The existing identity provider is reused; the stack creates neither another
identity server nor an unrestricted administrator account.

| Variable | Value |
|---|---|
| CONSOLE_PUBLIC_ORIGIN | Exact public HTTPS origin, e.g. https://console.your-domain.tld |
| CONSOLE_OIDC_ISSUER | Exact HTTPS staff-realm issuer |
| CONSOLE_OIDC_CLIENT_SECRET | Existing confidential client's secret |
| CONSOLE_STAFF_ROLES | Explicit comma-separated roles permitted to enter the console |
| CONSOLE_OIDC_CLIENT_ID | Defaults to mobicred-console; match the existing client |
| CONSOLE_OIDC_AUDIENCE | Defaults to mobicred-console; match the token audience |

Use confidential-client authorization-code flow with S256 PKCE. Register the exact
callback `https://console.your-domain.tld/auth/callback` and the public origin,
without the internal port and without wildcard redirect URLs. Introspection must
expose active status, issuer, subject, audience, expiry and staff roles. Configure
MFA at the staff identity provider. Do not create per-partner console identities
or wildcard tenant claims to approximate platform staff access.

The API and web containers must reach and trust the HTTPS issuer. The internal
Compose transport exception applies only to `http://api:3005`; it does not relax
TLS for the issuer or owner services. Never disable TLS verification to fix setup.

## Generated persistent secrets

The Compose definition requests these Coolify-generated values:

| Variable | Purpose |
|---|---|
| SERVICE_PASSWORD_POSTGRES | Shared by PostgreSQL and the API database connection |
| SERVICE_HEX_64_SESSION | API encryption for stored staff tokens |
| SERVICE_HEX_64_LOGIN | Web encryption for short-lived login-flow cookies |
| SERVICE_URL_WEB_3006 | Coolify routing metadata; not a replacement for CONSOLE_PUBLIC_ORIGIN |

Verify the password and both independent encryption keys are populated before the
first deployment. Each encryption key is 64 hexadecimal characters (32 random
bytes), not Base64. On older Coolify installations that do not populate the hex
generators, enter two independent values from `openssl rand -hex 32` once.

Keep these values stable across normal redeployments. Replacing a database password
variable does not change the password stored in an existing PostgreSQL volume.
Coordinate credential/key rotation and session revocation; do not delete storage.
The web container does not receive the database password or token-encryption key.
The API does not receive the login-cookie encryption key.

## Connect native partner administration

Set **CONSOLE_CORE_URL** on the API to the Core HTTPS origin hosting
`/internal/staff/partner-workspace`. Core's corresponding staff contract and
PartnerWorkspaceCommands migration must be deployed using Core's release process.
Deploying this console does not deploy or migrate Core.

The console delegates the verified staff token. Core independently checks the
signature, staff issuer, subject, expiry, role and audience. Core's
PARTNER_WORKSPACE_AUDIENCE defaults to mobicred-console and must match the staff
token. The current native partner roles are ADMIN/OPS for reads and onboarding;
ADMIN is required for credential issuance, rotation and revocation. These roles
must also satisfy console entry permission. External API clients retain their own
partner/environment keys, source-IP policies and request-signing rules.

Without the compatible Core contract, partner operations are unavailable, not
simulated. There is no fallback to the older unaudited admin mutations. See
`platform-staff-and-partners.md` for the full ownership and command boundaries.

## Enable other capabilities deliberately

Case writes and optional credit/ingestion reads default disabled. Configure the
appropriate staff roles to enable investigation operations:

```dotenv
CONSOLE_CASE_WORKFLOWS_ENABLED=true
CONSOLE_CASE_WRITE_ROLES=YOUR_CASE_OPERATOR_ROLE
CONSOLE_AUDIT_READ_ROLES=YOUR_AUDIT_READER_ROLE
CONSOLE_CASE_REPORT_ROLES=YOUR_REPORT_READER_ROLE
```

Optional Credit Intelligence reads use CONSOLE_CREDIT_URL (HTTPS origin only),
CONSOLE_CREDIT_READS_ENABLED / CONSOLE_CREDIT_READ_ROLES and
CONSOLE_INGESTION_READS_ENABLED / CONSOLE_INGESTION_READ_ROLES. Each owner must accept
the delegated token independently. Enabled write/read gates require explicit role
configuration. Missing financial, alias and other owner capabilities remain
unconnected; deployment cannot invent them. See `implementation-coverage.md`.

## Startup and updates

Deploy the single resource. PostgreSQL becomes healthy; the API validates its
configuration, safely encodes database credentials, acquires a PostgreSQL advisory
lock and applies pending registered console migrations in one transaction. Nest
starts only after that succeeds. Web starts after database-backed API readiness.
There is no manual seed, schema-reset or separate one-shot migration resource.

The PlatformStaffContext upgrade revokes obsolete sessions so staff sign in under
the new global model. Historical cases, notes and audit records are preserved.
Keep the same volume and encryption keys when redeploying. Back up and rehearse
production migrations before applying them.

The web image uses monorepo-aware Next standalone output and its static assets.
Both application images run non-root with read-only root filesystems, bounded
temporary directories and dropped capabilities. The definition publishes no host
ports. `/api/v1/health/ready` checks the API and PostgreSQL; web `/health` returns a
minimal readiness response for that dependency chain. These are not proof of a
working identity provider or healthy external owners.

Restart policy handles exited processes; unhealthy status alone is not a promise
that Docker will restart a hung process. Keep one API replica initially. Startup
serialization does not make arbitrary schema changes zero-downtime compatible;
large migrations need a reviewed rollout outside the startup runner's timeouts.

After the one-time setup, redeploy this resource for future main releases. With
GitHub/Auto Deploy configured, approved main changes can trigger deployments. A
merged PR is not itself evidence that the running environment has updated.

## Persistence and operational responsibilities

`console-postgres` is a named PostgreSQL 16 volume mounted at
`/var/lib/postgresql/data`. Normal container recreation preserves it. Deleting the
resource's storage or using `docker compose down --volumes` destroys that data.
A persistent volume is not a backup: schedule backups and test restore before
storing real operational records.

The bundled database bootstrap role also runs migrations. Environments requiring
separate migration/runtime database principals must provision and review that
privilege separation. Do not upgrade a PostgreSQL major version by only replacing
its image tag. Review base-image updates and pin approved digests when immutable
rebuilds are required. None of these source changes modifies a live environment.

## Troubleshooting

A required-variable error should be fixed in the resource settings, not by adding
secrets to Git or build arguments. Origin errors require the exact public HTTPS
origin, not the container port or generated URL metadata. Migration errors require
log/credential/history review and a safe forward fix, not volume deletion. Login
denial requires checking issuer/audience/role mappings, expiry, callback and TLS;
a tenant mapper is not required. Partner unavailability requires the matching Core
contract, its migration, compatible staff permissions and CONSOLE_CORE_URL.

## Verification boundary

Console compose checks build the actual images, cold-start a fresh database, test
HTTPS fixture sign-in, static assets, secure sessions, persisted cases, migration
idempotence, container/database recreation and readiness failure/recovery. The
synthetic identity/edge fixture is isolated to the CI overlay and excluded from
production images. These checks do not claim live Coolify or Core connectivity.

Official references: https://coolify.io/docs/applications/builds/docker-compose,
https://coolify.io/docs/applications/configuration/health-checks,
https://nextjs.org/docs/app/api-reference/config/next-config-js/output,
https://docs.docker.com/compose/how-tos/startup-order/.
