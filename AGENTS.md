# Repository working agreement

## Mandatory delivery order

All implementation and fix PRs target `develop`. After checks pass, merge the
feature PR into `develop`, open a promotion PR from `develop` into `staging`,
validate it, then open a promotion PR from `staging` into `main` and validate it.
Never target feature PRs directly at `staging` or `main`. Do not push directly,
force-push, bypass failing checks, or squash/rebase promotion PRs. Preserve
ancestry with merge commits. Do not delete the three long-lived branches.

The repository owner has requested this merge-and-promotion sequence for
implementation work. A branch merge is not evidence of a deployment. Report the
actual PRs, merge commits, check results and any remaining runtime configuration.
See `docs/release-flow.md` for the verification checklist.

## Product boundaries

The console owns staff sessions, investigations, notes, operational coordination
and audit receipts. Customer, lending, payment, score, alias and credential
execution stays in each owner service. Never use a catch-all internal-key proxy,
infer a tenant grant from a selector, or replace failed live reads with fixtures.
Use explicit, allowlisted adapters, verified staff roles/tenant scope, bounded
responses and independent owner availability states. Preview data is synthetic
and must remain unavailable in production.

## Validation

Run API compilation and Jest, web policy tests, production web build and lint,
PostgreSQL integration tests, preview/mobile browser tests and authenticated
browser journeys. Add regression tests for authorization, tenant isolation,
malformed upstream data and failure behavior for every new live surface.
Keep `docs/implementation-coverage.md` accurate; UI coverage is not live API coverage.
