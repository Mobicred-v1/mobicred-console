# Live ingestion quality and effective capability views

## Owner contract

The read-only adapter uses Credit Intelligence's existing
`GET /api/v1/ingestion/admin/data-source-quality?tenant_id=<verified tenant>`.
The owner filters its source table before grouping and joins ingestion jobs on
both tenant and source code. The console requires the echoed filter and every
returned row to match the verified tenant. It rejects the entire response on a
scope mismatch, duplicate source, invalid counter, invalid timestamp or inventory
above 500 sources. No raw job payload, sample row, credential or object-storage
URL is sent to the browser.

The source contract is the IngestionAdminController and
ReferenceDataRepository.getDataSourceQuality implementation inspected in
service-credit-intelligence at revision 70721745c1d5a4a8d0f34176073a17524b675960.
This does not wire the unscoped ingestion-job CRUD endpoints.

## Configuration

Set these on the API service, not in NEXT_PUBLIC variables:

- CONSOLE_INGESTION_READS_ENABLED=true
- CONSOLE_INGESTION_READ_ROLES=<explicit staff role allowlist>
- CONSOLE_CREDIT_URL=<HTTPS origin only, no path or credentials>

The delegated staff access token must also be accepted by the owner service's
Keycloak admin policy and audience configuration. The console cannot grant those
owner permissions. There is no fallback to an internal service API key.

The origin is deployment configuration, never request input. Only fixed GET paths
are reachable; redirects are refused, calls time out, and response bytes are
bounded during streaming. The existing credit adapter now shares this transport.

## Meaning of the views

Data ingestion displays source activity, consent basis, owner-scale trust,
historical total/accepted/failed counts and the last received timestamp.
Historical failures do not imply a current outage. No deliveries means never
observed, not healthy. Snapshots older than five minutes are explicitly stale.

Configuration shows effective console gates/configuration/permissions only;
origins and secrets are excluded. People & access shows only the current verified
identity and its effective capabilities, not a full staff or agency directory.
Operations shows adapter policy with reachability explicitly untested. No health
is inferred from a configured URL. No edits, financial actions or retries are
introduced. Owner reprocessing and source mutations remain disabled.

## Verification

API regression tests cover transport limits, redirects, authorization failures,
tenant mismatches, malformed aggregates, duplicates and stale snapshots. Web
policy tests cover the mapped display semantics. The authenticated browser job
uses an isolated owner fixture; it is not a claim of production connectivity.
