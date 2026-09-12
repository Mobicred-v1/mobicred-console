## Change

Describe the behavior and its owner-service boundaries.

## Validation

Record current-commit build, unit, database and browser checks. Distinguish
fixture verification from live deployment verification.

## Promotion

- [ ] Feature/fix targets `develop`, or promotion is `develop -> staging` / `staging -> main`.
- [ ] Current candidate checks pass and review requests are resolved.
- [ ] Merge commit preserves ancestry; no direct push or force push.
- [ ] Runtime configuration and migration requirements are documented.
