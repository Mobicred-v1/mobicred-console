# Verified staff boundary

Staff routes no longer treat the presence of a Bearer header as authentication.
The BFF introspects the access token with the configured Keycloak confidential
client on every request. Identity outages fail closed; tokens are not logged.

Required API environment:

- CONSOLE_OIDC_ISSUER: exact HTTPS staff realm issuer
- CONSOLE_OIDC_CLIENT_ID and CONSOLE_OIDC_CLIENT_SECRET: confidential introspection client
- CONSOLE_OIDC_AUDIENCE: expected access-token audience
- CONSOLE_STAFF_ROLES: explicit comma-separated permitted staff roles

The introspection response must include active=true, iss, sub, aud, exp, roles
in realm_access or resource_access[CONSOLE_OIDC_AUDIENCE], and a tenant_ids
string array (or tenant_id string). Configure the corresponding Keycloak
protocol mappers. A requested x-mobicred-tenant-id must be granted by those
verified claims. Never assign wildcard tenants or infer grants from a selector.
HTTP is permitted only for loopback identity services outside production.

Case list, count, detail and composed workspace queries include tenant scope in
the database predicate, before pagination. Missing scope fails closed. Case IDs
belonging to another tenant are indistinguishable from missing IDs.

Generic case mutations are temporarily disabled. They must be replaced by
role-checked, transactionally audited, concurrency-safe commands before use.
This intentionally removes the unsafe scaffold write path instead of calling
it production-ready. No owner service is made writable by this change.

Checks: API compilation and Jest tests; web compilation and ESLint in CI.
