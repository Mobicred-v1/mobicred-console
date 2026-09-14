# Verified Mobicred staff boundary

Authentication answers whether the actor is authorized Mobicred staff. It does not
ask which partner they work for. The login has no tenant field and requires no
tenant claims. The token must be active, signed/verified by the configured identity
service, use the exact issuer and audience, have a subject and valid expiry, and
carry an explicitly permitted staff role.

Browser cookies contain only an opaque HttpOnly session identifier. Server-side
session records encrypt tokens and retain optional working context. The global
web proxy checks this session before protected pages, nested paths, RSC/prefetch
responses or browser API handlers can render. Backend guards independently enforce
identity and operation permissions. Forged, missing, revoked and expired sessions
are rejected. Identity or database failures do not expose the navigation shell.

Only the explicit authentication/logout/health routes and static build resources
are public. Preview is disabled in production, not an anonymous alternate console.
Already-open tabs revalidate on focus/restore and at the session boundary; they
lock or reauthenticate on failure instead of continuing to accept mutations.

## Context is not a role grant

The default staff workspace spans Mobicred's partners. A selected partner and API
environment is validated against Core and narrows operations. Both values are used
for record predicates because environment identifiers can repeat across partners.
Clearing context restores global work without another login.

Context changes increment a persisted session version. Mutation forms must present
the version they loaded. Stale forms fail with 409, and case transactions recheck
and lock the session before committing. Partner commands carry an explicit owner
target and receive independent owner authorization. Caller headers never grant a
staff role, bypass an owner policy or create an arbitrary tenant identity.

## Controlled writes and secrets

Case changes, notes, audit records and receipts commit atomically with idempotency
and optimistic version checks. Partner mutations execute in Core's native records
with durable owner receipts. API secrets are returned once and excluded from
normal inventories, browser storage, receipt replays and audit metadata.

Neutral sign-in wording does not conceal the external identity provider or replace
patching and authorization. The production security controls are the verified
session, origin checks, least-privilege permissions and owner-enforced commands.
See `platform-staff-and-partners.md`, `live-integration.md` and `coolify.md`.
