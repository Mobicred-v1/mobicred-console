# Authenticated console integration

## What this connects

- Keycloak authorization-code login with S256 PKCE, short-lived encrypted state,
  exact redirect origin, and server-side access-token introspection.
- Opaque HttpOnly browser sessions backed by Postgres. Access tokens are encrypted
  at rest; only a hash of the opaque session identifier is stored in the database.
- Tenant-scoped investigation list, detail and composed owner availability.
- Optional read-only Credit Intelligence search using its verified existing
  `/api/v1/score-decisions/admin/search` contract. Each response row must match the
  verified tenant; raw decision traces and internal API keys are never forwarded.

No production owner mutations are introduced. Case writes remain unavailable
until the audited case-command change is installed. Other workspaces keep their
explicit unavailable state until their staff contracts are connected.

## API configuration

Existing DATABASE_URL and database settings apply. Also set:

- CONSOLE_OIDC_ISSUER: exact HTTPS Keycloak staff-realm issuer
- CONSOLE_OIDC_CLIENT_ID / CONSOLE_OIDC_CLIENT_SECRET: confidential introspection client
- CONSOLE_OIDC_AUDIENCE: required access-token audience
- CONSOLE_STAFF_ROLES: explicit comma-separated permitted staff roles
- CONSOLE_SESSION_ENCRYPTION_KEY: 64 hex characters from 32 cryptographically random bytes
- CONSOLE_RUN_MIGRATIONS: true for a controlled migration rollout, false normally
- CONSOLE_CREDIT_READS_ENABLED: true only after verifying owner permissions
- CONSOLE_CREDIT_URL: HTTPS origin only, without API path
- CONSOLE_CREDIT_READ_ROLES: explicit roles allowed to read credit evidence

Register protocol mappers so introspection includes tenant_ids (string array),
roles, iss, aud and exp. The selected tenant must be granted in those verified
claims. The credit service must accept the staff token's issuer/audience and
must enforce its own authorization. The BFF independently validates row scope.

Migrations are now explicitly registered, including the existing cases migration,
uuid-ossp prerequisite, tenant index and encrypted sessions. The database account
must be permitted to install uuid-ossp, or a DBA must preinstall it. Schema sync
remains disabled. Production database access and migrations were not executed by
this PR. Verify migrations against a staging backup before production rollout.

## Web configuration

- CONSOLE_ENV=production for production; development permits loopback HTTP locally
- CONSOLE_PUBLIC_ORIGIN: exact HTTPS console origin
- CONSOLE_API_URL: HTTPS BFF origin (or loopback in explicit development)
- CONSOLE_OIDC_ISSUER / CONSOLE_OIDC_CLIENT_ID / CONSOLE_OIDC_CLIENT_SECRET
- CONSOLE_LOGIN_COOKIE_KEY: a separate random 64-hex-character key
- CONSOLE_PREVIEW_ENABLED=false for production

Register exactly `CONSOLE_PUBLIC_ORIGIN/auth/callback` in the Keycloak client.
Client authentication and standard authorization-code flow must be enabled;
require S256 PKCE and staff MFA in the realm. No wildcard redirect URLs.
Secrets are server-only: never prefix them with NEXT_PUBLIC_. Do not commit them.

The first session implementation deliberately does not retain refresh tokens.
Sessions expire when their access token expires (maximum eight hours), and every
API request rechecks active status, roles and tenant grants by introspection.
Users reauthenticate after expiry. Logout revokes the console session and clears
the cookie; it does not claim to log out every Keycloak application. During an API
outage the cookie is still cleared and any remaining row expires with its token.
Key rotation invalidates old encrypted login flows/sessions; coordinate rotation.

## Limits and completion boundary

The case and scoring lists currently load a bounded first page of up to 100 rows;
UI totals explicitly refer to that result set. Customer, payment, partner,
configuration, people, alias and production report reads are not fabricated from
unsafe unscoped APIs. Connect each missing owner contract in a follow-up change.
Preview remains a separate opt-in route and is never a live-data fallback.
