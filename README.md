# MobiCred Console

Internal operations console. Next.js UI + NestJS BFF.

See `docs/architecture.md`.

## Apps

```
apps/web   Next.js staff UI   http://localhost:3006
apps/api   NestJS BFF         http://localhost:3005/api/v1
```

## Commands

```bash
bun install
bun run dev:api
bun run dev:web
```

API health: `GET http://localhost:3005/api/v1/health/live`

Investigation cases require a staff bearer token and `x-mobicred-tenant-id`.
Owner adapters fail closed until allowlisted staff reads exist in Core,
Payment Gateway, and Credit Intelligence.

## Generate more API surface

From `apps/api`:

```bash
ddd scaffold <Entity> -m <module> --fields "..." --no-delete
ddd generate query <Name> -m <module>
```
