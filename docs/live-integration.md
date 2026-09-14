# Authenticated console integration

## Authentication is platform-wide

This is a Mobicred staff console. Login verifies active status, exact issuer,
expected audience, subject, expiry and an explicitly allowed staff role. There is
no tenant or partner input at login and no tenant claim requirement. Do not add
wildcard tenant grants to approximate platform access.

The current identity adapter uses authorization-code sign-in with S256 PKCE,
encrypted short-lived login state and server-side introspection. Browser cookies
contain an opaque HttpOnly session identifier; tokens remain encrypted in Postgres.
The current implementation does not keep refresh tokens. Session expiry is bounded
by token expiry and the server limit; staff reauthenticate when it expires.

The global web proxy checks the actual server session before protected page, RSC
and browser API rendering. Individual handlers and the Nest global guard recheck
independently. Only explicit sign-in/logout/health and static resources are public.
Preview is a separate non-production, explicit opt-in path, never an outage fallback.

## API configuration

- CONSOLE_OIDC_ISSUER: exact HTTPS staff-realm issuer.
- CONSOLE_OIDC_CLIENT_ID / CONSOLE_OIDC_CLIENT_SECRET: confidential client.
- CONSOLE_OIDC_AUDIENCE: expected access-token audience.
- CONSOLE_STAFF_ROLES: explicit console-entry roles.
- CONSOLE_SESSION_ENCRYPTION_KEY: 64 hexadecimal characters from 32 random bytes.
- DATABASE_URL and existing database settings for native deployments.
- CONSOLE_RUN_MIGRATIONS: true only for a controlled native migration rollout; false for ordinary native startup after migrations are applied.

For a native deployment that starts `apps/api/dist/main.js` directly, there is no
Compose migration wrapper. Back up and rehearse the migration first, stop other
migration runners, and start exactly one native API instance with
CONSOLE_RUN_MIGRATIONS=true during the approved rollout. Nest applies the explicitly
registered migrations before accepting requests. Confirm completion, then use
CONSOLE_RUN_MIGRATIONS=false on normal starts. The migration account needs the
required schema privileges and uuid-ossp support, preinstalled by a DBA when
necessary. Never use schema synchronization or skip the PlatformStaffContext
migration: old schemas lack the partner_context and partner_code fields.

The introspection response must expose active=true, iss, sub, aud, exp and staff
roles in realm_access or the configured audience's resource_access. An nbf claim,
when present, must not be in the future. Staff MFA is configured at the identity
provider, not bypassed by the console.

Case writes, audit reads, reports and owner reads have their own configured role
settings. A console-entry role alone does not enable every mutation. See
`case-workflows.md`, `platform-staff-and-partners.md` and `ingestion-integration.md`.

## Optional partner context and native Core integration

Set CONSOLE_CORE_URL to the Core HTTPS origin. Fixed staff-workspace endpoints
receive the verified human actor token. The owner independently verifies the token
and its operation permissions; no internal service key is substituted.

Partner + API environment is selected after sign-in and verified against Core's
active records. Context is persisted in the server session with a version. Forms
carry that version; stale submissions return 409. Case SQL applies both partner
and environment predicates before pagination when context is selected. Global
staff views retain historical cases whose partner ownership is unknown rather
than guessing a mapping.

Core's partner-workspace contract and migration must be deployed before native
onboarding, credentials and customer-list operations can work. Existing Core API
clients retain partner/environment credential boundaries; they do not gain access
to the staff console. See `platform-staff-and-partners.md` for owner settings.

## Web and Compose configuration

- CONSOLE_ENV=production and CONSOLE_PREVIEW_ENABLED=false.
- CONSOLE_PUBLIC_ORIGIN: the explicit public HTTPS origin, without an internal port.
- CONSOLE_API_URL: the API HTTPS origin for native deployments.
- CONSOLE_OIDC_ISSUER / CONSOLE_OIDC_CLIENT_ID / CONSOLE_OIDC_CLIENT_SECRET.
- CONSOLE_LOGIN_COOKIE_KEY: an independent random 64-hex-character key.

Register exactly `<CONSOLE_PUBLIC_ORIGIN>/auth/callback` in the existing identity
client, with confidential-client authorization-code flow and S256 PKCE. Do not use
wildcard redirects. Secrets are server-only, never NEXT_PUBLIC variables.

The root Compose definition retains one web/API/PostgreSQL resource. Its narrow
internal transport allows only the explicitly selected `http://api:3005`; it does
not relax HTTPS validation for public origins, the identity issuer or other owners.
Its startup runner applies registered console migrations under a database lock.
Do not run a second migration runner concurrently or enable schema synchronization.

## Upgrade, logout and availability

The PlatformStaffContext migration revokes obsolete tenant-bound sessions while
preserving cases, notes and audit history. Staff sign in again under the platform
model. Keep the existing database volume and encryption keys; do not reset storage
to apply the update. Back up and rehearse production migrations first.

Logout revokes the console session and clears its cookie. It does not claim to end
every application session at the external identity provider. An infrastructure
outage blocks access instead of inventing valid identity or serving preview data.
Removing outward provider labels is UX hygiene, not a replacement for these checks.
