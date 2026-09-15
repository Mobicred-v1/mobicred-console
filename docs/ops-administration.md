# Operations first; optional administration context

## Identity, filter and command target are separate concepts

The console is a Mobicred staff tool. Staff authenticate once; no partner/tenant
credential or tenant choice is part of console login. The landing page is an
operations workspace with links to partner onboarding, the global partner directory,
and actual investigation commands. A valid existing session visiting login returns
to that workspace without resetting its filter or creating another session.

A selected partner/API environment is an optional operational filter. It narrows
case/credit/ingestion operational views; it is not a new login, external-partner
identity, role grant, or prerequisite for using the console.

Partner administration is global: `/partners` always means the directory, even
with an active filter. `/partners/:code` always administers the explicit partner
in that route and shows its environments, credential metadata and customer links.
That administration page clearly says the operational filter is not applied there.
The filter is retained unchanged when browsing another partner or onboarding one.

Staff-authorized partner commands carry explicit partner and environment targets.
They do not inherit either target from a session. Adding an environment uses its
entered identifier, issuing a credential requires an explicit active environment,
and rotation/revocation target the selected credential's own pair. Context-version
checks still reject stale forms; Core still independently authorizes the delegated
staff token, its roles, the target pair and the requested scopes. Partner API
credentials never grant console access. Case isolation remains unchanged.

## Onboarding and credentials

Onboarding creates the native Core partner, first API environment and initial
source-IP/scope policy atomically. It does not issue a credential or change the
operator's session/filter. Issue credentials separately in the new partner's
Credentials tab. The API environment field is about a partner application, not
about connecting the operator to a tenant.

Credential rotation preserves existing expiry when no replacement date is entered.
Invalid/past expiry is rejected before submission. Once a command is attempted its
form is frozen, including selects. A retry uses the original serialized payload and
idempotency key rather than serializing disabled controls or generating a new key.
The first successful issuance reveals its secret once; an uncertain-response retry
may return a committed receipt without a secret and must not issue again silently.

## Scope control and availability

The scope selector has directory pagination and cancels obsolete requests. Closing
a read-in-progress is permitted. Returning to all partners is independent of the
partner-directory read, so an owner outage cannot trap staff in a filtered view.
Existing auth/session expiry and revocation checks remain in force.

No external-service status is fabricated on the new operations home. It displays
console investigation data and navigation, not an unimplemented financial health
or alert dashboard. New investigation opens the real audited command form rather
than the disabled preview-only button formerly used on the live overview.

## Deployment and test boundary

The owner supplied these deployment mappings:
- staging -> https://staging-console.mobicred.net
- main -> https://console.mobicred.net

Promote feature -> develop -> staging -> main with tested, ancestry-preserving merge
commits. The deployed observations workflow makes bounded anonymous GET requests
only, persists status/redirect/boolean observations rather than HTML, and does not
submit login or send credentials. These reads do not verify authenticated partner
operations. Those are covered by the isolated full-browser, API policy and database
suites, with synthetic records only. Core's independent production release remains
a separate dependency; do not replace it with preview data or a catch-all API key.
