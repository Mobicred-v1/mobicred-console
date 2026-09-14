# Mobicred staff console and partner operations

## Ownership and sign-in

Mobicred owns the platform. Staff sign in once with the configured staff identity
provider. There is no tenant field, tenant claim requirement or partner selection
in the sign-in flow. The required token claims are active status, exact issuer,
console audience, subject, expiry and explicitly permitted staff roles.

The default workspace covers all partners. Partner + API environment is optional
operational context, verified against Core and stored in the opaque server session.
Clearing context restores the global workspace without another sign-in. It is not
an external partner identity and does not grant a staff role. Partner API clients
continue using their own credentials and environment identifiers.

The legacy tenant_id database column remains a data partition, not an identity
boundary. New unscoped cases use an internal platform partition. Partner cases are
filtered by BOTH partner_code and tenant_id, because environment identifiers may
be reused by different partners. Legacy rows are retained and visible globally;
unknown historical partner ownership is never guessed.

Migration PlatformStaffContext invalidates existing sessions so staff sign in
under the new model. It preserves case/note/audit history. The existing Compose
migration runner applies the console migration automatically before API startup.

## Session enforcement

Next's global proxy validates the opaque session against the API before serving
pages, nested record routes, RSC/prefetch requests or browser API handlers. Missing,
forged, expired and revoked sessions cannot render the console shell. API handlers
also recheck sessions. Nest's default-deny global guard independently verifies
identity on every protected request. Only explicitly public sign-in/logout/health
routes and static build assets are outside that boundary; disabled preview routes
return 404 even when authenticated.

Identity/database outages fail closed with a generic unavailable page. The client
locks already-open tabs on revalidation, redirects at expiry, and rechecks when a
tab regains focus or is restored from browser history. Changing partner context
increments a server-side version. Mutation forms carry that version; stale tabs
receive 409. Case transactions lock/recheck the session before committing, so a
concurrent context switch cannot move a case operation into another partition.
Partner commands always carry an explicit partner/environment target.

Staff UI uses Mobicred branding and neutral sign-in language. Removing vendor labels
is not an authentication control: token validation, session revocation, request
origin checks, permission enforcement and owner-side checks remain mandatory.

## Core contract and configuration

Set CONSOLE_CORE_URL to Core's HTTPS origin on the API container. No internal API
key is used. Console delegates the verified staff access token to the fixed
/internal/staff/partner-workspace routes added by service-core-api PR #63.
The owner independently verifies the signature, exact issuer, console audience
(PARTNER_WORKSPACE_AUDIENCE, default mobicred-console), subject, expiry and roles.

ADMIN and OPS may read/onboard partners and environments. Only ADMIN may issue,
rotate or revoke API credentials. Access policies remain Core-owned. Apply Core's
PartnerWorkspaceCommands migration with its ordinary migration rollout before
enabling that owner contract. Deploying Console does not deploy Core or migrate
Core's database. Missing contracts show unavailable; they never fall back to
legacy unaudited mutations or synthetic records.

## Implemented partner lifecycle

The partner workspace provides server-side partner search/pagination, partner
profile, environments, IP/scope policies, safe credential metadata and paginated
partner customer links. Partner creation atomically creates the native Core
organization, first environment and policy. Additional environments can be added.
Credential issuance, atomic replacement/revocation and revocation use the same
native key format and hash validation as the existing partner APIs.

Every write requires a reason and an actor-bound UUID request key. Core commits
native domain changes and an append-only audit/receipt in one transaction. A failed
audit insert rolls back the change. Concurrent retries return one receipt. API
secrets are returned only once and are never stored in browser storage, audit,
notes or request receipts. The UI clears the secret on close or after two minutes.
An ambiguous retry returns metadata without revealing or regenerating a secret.
Inspect the credential and deliberately rotate/reissue when necessary.

The initial policy requires explicit source IPs and supported scopes. API calls
use X-Partner-Code, X-Tenant-Id, X-API-Key and X-API-Key-Id. Core additionally enforces
its configured request HMAC, expiry, status and rate-limit rules. These API-only
headers never select the staff console's login or grant its permissions.

## Delivery and verification

The latest main hotfix making CONSOLE_PUBLIC_ORIGIN explicit is preserved. No
production credentials, Core data, identity configuration or live Coolify resource
are modified by these source changes. Tests use temporary databases and isolated
identity/owner fixtures; production connectivity must be validated after rollout.
Feature PRs target develop, followed by checked develop -> staging -> main merges.
Core already has unrelated release-branch divergence; its release differences
must be evaluated before promotion, not overwritten with the console feature.
