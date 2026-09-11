# MobiCred Console

Staff operations console. One product, two apps:

- `apps/web` — Next.js staff UI
- `apps/api` — NestJS staff BFF (`ddd` CLI)

## Purpose

Unify customer investigations, payment exceptions, credit operations, partner
administration, configuration, and audit. Execution stays in the services that
own it.

## Not this product

- Not a Fineract replacement
- Not a second Core
- Not a rewrite of Mifos, gateway Filament, POS, or the developer portal
- Not a catch-all proxy that forwards arbitrary paths with an internal API key
- Not a place for demo data when live data is missing

## Ownership

| Responsibility | Owner |
| --- | --- |
| Navigation, case presentation, staff session | Console |
| Customer/business status, lending, partner policies | Core |
| Banking records and financial execution | Fineract via approved Core paths |
| Provider payment state | Payment Gateway |
| Scores, evidence, ingestion | Credit Intelligence |
| Alias directory | Alias service |
| Staff identity | Keycloak |

The console may persist case assignments, comments, and pointers. It must not
grow a second customer, loan, or payment database.

## First surface

Investigation inbox. Opening a case composes owner slices. Each slice is
`live`, `stale`, `unavailable`, or `unauthorized`. Disagreements stay visible.

Visual identity is deferred until a dedicated design-research pass. The
functional rule is already locked: never collapse owner statuses.
