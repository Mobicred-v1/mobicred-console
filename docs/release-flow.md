# Release flow

`feature/* (or codex/*) -> develop -> staging -> main`

Every implementation/fix PR targets develop. Only the same repository's develop
branch can target staging; only its staging branch can target main. The Branch
policy workflow checks this on PR creation, synchronization, reopening, retargeting
and readiness changes. Promotion branches are long-lived; never delete them.

## Before each merge

1. Inspect the PR diff and current head/base SHAs. Resolve review requests and
   conflicts without bypassing protection or rewriting a shared branch.
2. Wait for successful Console checks, Console browser checks, Console database
   checks, Console authenticated browser checks and Branch policy. Additional
   feature-specific checks must also pass. Validate the current candidate, not an
   older commit. Recheck after any head/base change.
3. Use a merge commit and an expected-head-SHA guard. Do not squash/rebase
   promotions: subsequent promotions need the shared commit ancestry.
4. Record the resulting merge commit. Promote develop into staging first; only
   then promote staging into main. Re-run the complete PR checks at both stages.
5. After main merges, verify the branch trees contain the same intended code and
   verify post-merge checks. Different merge commit SHAs are expected.

## Enforcement and deployment

The workflow provides a failing status for an invalid route. A repository
administrator must make Branch policy and the test jobs required in branch
protection/rulesets to make that status a hard merge gate. Do not claim the
workflow alone prevents an administrator from bypassing it. No rulesets,
permissions, production secrets or deployment credentials are changed by this file.

CI uses temporary databases and fixture identities. Git branch promotion does
not deploy infrastructure, configure Keycloak, enable owner APIs, or run production
migrations. Actual deployments require an independently configured environment
pipeline, approved secrets, HTTPS, backups and controlled migration execution.
