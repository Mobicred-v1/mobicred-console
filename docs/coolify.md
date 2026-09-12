# Deploy once in Coolify

This repository is one **Git-based Docker Compose Application** containing three
long-running services: `web`, `api`, and `postgres`. Do not create separate Coolify
applications or a separate database. Do not choose Docker Compose Empty: that
resource does not check out this repository, while these images need its source.

## One-time resource setup

1. In your project/environment, add a resource from the GitHub repository
   `Mobicred-v1/mobicred-console` (GitHub App or public repository).
2. Select branch **main**, build pack **Docker Compose**, Base Directory **/**,
   and Docker Compose Location **/docker-compose.yml**. Save/load the definition.
3. On **web only**, set an HTTPS domain, for example
   `https://console.your-domain.tld:3006`. The `:3006` selects the internal target
   port; visitors still use `https://console.your-domain.tld`. Configure DNS to
   point to your Coolify server and let Coolify issue the certificate.
4. Enter the identity settings below under Environment Variables. Keep Raw Compose
   Deployment off. Disable **Inject Build Args to Dockerfile**: no application
   secrets or environment-specific URLs are needed to build these images.
   Leave custom build/start commands empty. Keep Connect To Predefined Network
   off unless separately reviewed cross-resource networking is genuinely needed.
5. Deploy. PostgreSQL becomes healthy, API startup applies pending migrations,
   API database readiness passes, and then the web app starts. No terminal command,
   manual database creation, migration resource, or seed command is required.

After this setup, redeploy this same resource. With the GitHub integration and
Auto Deploy enabled, changes promoted into main can trigger redeployments. Never
point the production resource at a feature branch. PR previews must use a separate
resource/volume/identity client, not production storage.

## Required identity settings

The console deliberately reuses your existing Keycloak staff realm; it does not
create another identity provider or generate an administrative user/password.

| Coolify variable | Value |
|---|---|
| `CONSOLE_OIDC_ISSUER` | Exact HTTPS realm issuer, e.g. `https://identity.your-domain.tld/realms/staff` |
| `CONSOLE_OIDC_CLIENT_SECRET` | Secret of the confidential Keycloak client |
| `CONSOLE_STAFF_ROLES` | Explicit comma-separated roles allowed to enter this console |
| `CONSOLE_OIDC_CLIENT_ID` | Defaults to `mobicred-console`; change to the existing client ID when needed |
| `CONSOLE_OIDC_AUDIENCE` | Defaults to `mobicred-console`; must match the access token audience |

In Keycloak, use a confidential OpenID Connect client with Standard Flow and S256
PKCE. Register the **exact** redirect URI
`https://console.your-domain.tld/auth/callback` and the exact web origin
`https://console.your-domain.tld` (no internal `:3006` and no wildcard redirect).
Configure token/introspection mappers so the access token exposes the required
`aud`, staff roles in `realm_access` or the configured audience's `resource_access`,
and a `tenant_ids` string array or `tenant_id` string. The login form's tenant must
be included in those verified grants. Selecting a tenant does not create access.

Issuer and audience comparison is exact. The API and web containers must reach
the HTTPS issuer and trust its TLS certificate. The Compose HTTP exception applies
only to `http://api:3005`; it never applies to Keycloak or owner services. Do not
use `NODE_TLS_REJECT_UNAUTHORIZED=0` or expose the API to work around configuration.

## Values Coolify generates and keeps

| Generated variable | Used by |
|---|---|
| `SERVICE_PASSWORD_POSTGRES` | PostgreSQL and API database connection |
| `SERVICE_HEX_64_SESSION` | API encryption for stored staff access tokens |
| `SERVICE_HEX_64_LOGIN` | Web encryption for short-lived PKCE login-flow cookies |
| `SERVICE_URL_WEB_3006` | Web public origin, derived from the web domain |

The hex variables must contain **64 hexadecimal characters** (32 random bytes),
not a Base64 string. Coolify's current Compose parser supports these generators.
Check that all three generated secrets are populated and that the generated URL
has HTTPS before the first deploy. On older Coolify versions without hex generators,
supply independent `openssl rand -hex 32` values in those two variables once.

Never regenerate these values on an ordinary redeploy. Changing only the database
password environment does not change a password in an existing PostgreSQL volume.
Changing the session key invalidates decryption of existing sessions; coordinate
rotation and session revocation. The web container does not receive the database
password or session-encryption key. The API does not receive the login-cookie key.

## Enable only the capabilities you intend to authorize

The stack starts with owner reads and case writes disabled, matching the existing
application's fail-closed defaults. Sign-in and scoped read workflows remain
available. To enable the implemented case workflow, set:

```dotenv
CONSOLE_CASE_WORKFLOWS_ENABLED=true
CONSOLE_CASE_WRITE_ROLES=YOUR_CASE_OPERATOR_ROLE
CONSOLE_AUDIT_READ_ROLES=YOUR_AUDIT_READER_ROLE
CONSOLE_CASE_REPORT_ROLES=YOUR_REPORT_READER_ROLE
```

Use real roles from your staff realm; each allowed role must also satisfy the
console entry-role policy. API startup refuses enabled write/read gates without
their explicitly configured roles. These commands affect investigations, not money.

Optional Credit Intelligence reads use `CONSOLE_CREDIT_URL` (HTTPS origin only),
`CONSOLE_CREDIT_READS_ENABLED` / `CONSOLE_CREDIT_READ_ROLES` and
`CONSOLE_INGESTION_READS_ENABLED` / `CONSOLE_INGESTION_READ_ROLES`. The owner must
independently accept the delegated staff token. Full owner integrations that are
still absent remain absent; Compose does not invent or bypass them. See
`implementation-coverage.md` and `ingestion-integration.md`.

## Containers and lifecycle

- Root-context multi-stage builds respect the Bun workspace lockfile. API runtime
  contains compiled Nest code and production API dependencies; web uses Next.js
  standalone output with monorepo tracing plus static/public assets.
- Both application processes run as UID 1000, with read-only root filesystems,
  bounded temporary directories, dropped capabilities and graceful shutdown.
- The production definition publishes **no host ports**. Coolify routes only the
  web domain to 3006. API 3005 and PostgreSQL 5432 are internal service addresses.
- API startup validates configuration, URL-encodes database credentials, acquires
  a PostgreSQL advisory lock, and runs pending registered migrations in one
  transaction before starting Nest. Restarts do not repeat applied migrations.
  Migration failure prevents API readiness and web startup. There is no schema
  synchronization, destructive reset, or automatic downgrade.
- `/api/v1/health/ready` checks API memory and PostgreSQL connectivity; `/health`
  on web checks that API readiness, without exposing credentials or diagnostics.
  Health reports infrastructure readiness, not successful Keycloak sign-in or
  full owner connectivity. Docker health status alone does not restart a hung
  process; the restart policy applies when a process exits.

Keep only one API replica during initial operation. Serialized migration startup
protects competing startup runners, but release migrations must still be reviewed
for compatibility with any old container serving requests. This is not a promise
of zero-downtime schema changes. Large migrations may need a separately reviewed
rollout beyond the startup runner's two-minute lock/statement timeouts.

## Persistence, backup and updates

`console-postgres` is a Compose-managed named volume mounted at PostgreSQL 16's
`/var/lib/postgresql/data`. It survives normal image builds and container recreation.
Coolify scopes volume names to the resource. Keep the same resource and volume;
deleting it or running `docker compose down --volumes` removes data.

A volume is **not a backup**. Configure scheduled PostgreSQL backups and test a
restore before using real operational data. The bundled database's bootstrap role
also runs migrations; installations needing separate migration/runtime database
roles should provision and review that privilege separation before production use.
Do not upgrade the PostgreSQL major version by simply changing its image tag.

Node and PostgreSQL images track supported major-version tags; Bun and application
packages are pinned/locked. Review base-image updates as part of deployment. For
immutable production rebuilds, pin reviewed image digests in a follow-up PR.

## Troubleshooting

- **Required variable missing:** fill the highlighted identity variable and verify
  the generated secrets. Startup errors name variables without printing values.
- **Public origin must be HTTPS:** set the web domain to HTTPS and verify
  `SERVICE_URL_WEB_3006` is the public URL without the internal container port.
- **API migration failure:** inspect API/database logs and credentials. Do not delete
  the volume to fix a migration. Back up and resolve with a reviewed forward change.
- **No available server:** check all three container health statuses and the web
  domain's target port 3006. Do not create an API domain or publish database ports.
- **Login denied:** check exact issuer/audience, client secret, role mappings,
  verified tenant grant, TLS reachability and the exact callback URI.

## Verification

`Console compose checks` builds both actual images, cold-starts this definition
against a fresh PostgreSQL volume, tests a production-mode HTTPS fixture login,
static assets, secure sessions, persisted audited cases, container/database
recreation, migration idempotence and database-failure readiness/recovery. The
synthetic edge/IdP exists only in `tests/compose/compose.test.yml` and is excluded
from production images. It does not replace real Coolify/Keycloak deployment testing.
The ordinary unit, policy, database and browser workflows remain in place.

## Official references

- Coolify Git-based Compose setup, generated values, domains and networking:
  https://coolify.io/docs/applications/builds/docker-compose
- Coolify health checks: https://coolify.io/docs/applications/configuration/health-checks
- Next.js standalone and monorepo tracing:
  https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Docker startup order: https://docs.docker.com/compose/how-tos/startup-order/
