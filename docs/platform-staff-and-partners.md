# Mobicred staff console and partner operations

## Ownership and sign-in

Mobicred owns the platform. Staff sign in once with the configured staff identity
provider. There is no tenant field, tenant claim requirement or partner selection
in the sign-in flow. Required token claims are active status, exact issuer,
console audience, subject, expiry and explicitly permitted staff roles.

The default operations workspace covers all partners. Partner + API environment is
optional operational context, verified against Core and stored in the opaque server
session. Clearing it restores global operational work without another sign-in. It
is not an external partner identity and does not grant a staff role. Partner API
applications continue using their own credentials and environment identifiers.

Staff identity, operational filter and administration target are distinct. Partner
administration is always accessible to authorized staff independently of the filter:
`/partners` is the global directory and `/partners/:code` explicitly administers
that partner, including all its API environments and customer connections. Opening
Beta or onboarding Gamma while the operational filter is Alpha does not alter the
staff session or filter. Administration screens clearly identify their own target
and say that the operational filter is not applied there. See `ops-administration.md`.

The legacy tenant_id database column remains a data partition, not an identity
boundary. New unscoped cases use an internal platform partition. Partner cases are
filtered by BOTH partner_code and tenant_id, because environment identifiers may
be reused by different partners. Legacy rows are retained and visible globally;
unknown historical partner ownership is never guessed.

The earlier PlatformStaffContext migration invalidates obsolete sessions while
preserving cases, notes and audit history. The Compose runner applies registered
console migrations before API startup. The ops-first administration correction
introduces no additional migration or identity-provider configuration.

## Session enforcement

The global web proxy validates the opaque session against the API before serving
pages, nested record routes, RSC/prefetch requests or browser API handlers. Missing,
forged, expired and revoked sessions cannot render the console shell. API handlers
recheck sessions. Nest's default-deny global guard independently verifies identity
on every protected request. Only explicit public authentication/logout/health routes
and static build assets are outside that boundary. Production preview is disabled.

Identity/database outages fail closed. Already-open tabs revalidate, redirect at
expiry, and recheck on focus/history restoration. Context changes increment a
server-side version; mutation forms carry that version and stale tabs receive 409.
Case transactions lock/recheck the session so a concurrent switch cannot move a case
operation into another partition. Partner administration commands always carry an
explicit partner/environment target, independently checked by Core; they do not
inherit or get redirected by the optional operational filter.

The scope selector supports partner-directory pagination and cancels obsolete reads.
Returning to all partners does not wait for a directory read, so an owner outage
cannot trap the operator in a selected view. A valid staff session visiting login
returns to the operations home without creating another session or changing context.

Staff UI uses Mobicred branding and neutral sign-in language. Removing vendor labels
is not an authentication control: verified tokens, revocation, origin checks,
operation permissions and owner-side checks remain mandatory.

## Core contract and configuration

Set CONSOLE_CORE_URL to Core's HTTPS origin on the API container. No internal API
key is used. Console delegates the verified staff access token to fixed
/internal/staff/partner-workspace routes. Core independently verifies the signature,
exact issuer, console audience (PARTNER_WORKSPACE_AUDIENCE defaults to mobicred-console),
subject, expiry and roles. The actual Core success envelope is unwrapped before
strict DTO, target-pair and action-specific receipt validation.

ADMIN and OPS may read/onboard partners and environments. Only ADMIN may issue,
rotate or revoke API credentials. Access policies remain Core-owned. Release Core's
staff contract and PartnerWorkspaceCommands migration through its ordinary process
before enabling this integration. Console does not deploy or migrate Core. Missing
contracts remain unavailable without legacy unaudited or synthetic fallbacks.

## Implemented partner lifecycle

The partner directory provides search/pagination, profile and global onboarding.
Partner creation atomically creates the native Core organization, first API
environment and source-IP/scope policy. Additional environments can be added.
API credentials are issued separately after creation. No partner API credential is
needed to administer it using the Mobicred staff console.

Administration commands use an explicit target: entered new environment identifier,
selected active environment for issuance, or the existing credential's own
partner/environment for rotation/revocation. Console rotation preserves the previous
expiry unless an explicit replacement date is supplied. Invalid/past expiry is
rejected before sending. After an attempt the form freezes, including its selects;
retries reuse the original serialized request and idempotency key exactly.

Every write requires a reason and actor-bound UUID request key. Core commits native
domain changes and an append-only command receipt in one transaction. Receipt insert
failure rolls back the change; concurrent retries return one receipt. Staff outcome
audit also uses the existing Core audit infrastructure and its delivery semantics.
API secrets are shown once and excluded from browser storage, inventories, notes
and receipts. Closing the display or its two-minute timer removes the secret.
An uncertain-response retry may return a receipt without a secret; inspect the
credential before deliberately rotating/reissuing. Never automatically issue again.

The API enforces approved source IPs, supported scopes, status, expiry and configured
request-signing/rate limits. X-Partner-Code, X-Tenant-Id, X-API-Key and X-API-Key-Id
are partner application headers, not console login settings or staff role grants.

## Delivery and verification

Feature -> develop -> staging -> main promotions use checked merge commits and keep
the existing public-origin fix, data volumes and encryption keys. Staging publishes
https://staging-console.mobicred.net and main publishes https://console.mobicred.net.
Anonymous deployed observations and authenticated fixture tests are reported
separately. Read-only login/API checks cannot prove authenticated live onboarding.
Core's unrelated release divergence must be reviewed separately, not overwritten
as part of the console feature. No production partner or credential is created by
the isolated verification suites.
