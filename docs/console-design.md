# Mobicred Console implementation

The approved visual direction is implemented as responsive Next.js screens, not
an infographic background. Deep teal navigation, restrained green accents,
readable white work cards, explicit source badges and reference-led detail views
are shared across desktop and mobile.

## Routes

/overview, /inbox, /customers, /payments, /credit, /partners, /ingestion,
/aliases, /operations, /configuration, /approvals, /people, /audit, /reports.
Each section also has a /:id deep-link route. Unknown routes return 404.

Included: keyboard command navigation (Cmd/Ctrl+K), searchable tables, status and
category filters, pagination, detail dialogs with native focus trapping and
Escape dismissal, notifications, profile/scope view, customer context, payment
owner-state comparison, credit evidence/execution boundaries, partner access
views, role matrix, configuration comparisons, ingestion, aliases, and service
readiness. Preview CSV values are escaped against spreadsheet formula injection.

## Preview safety

Set CONSOLE_ENV=preview (or development) AND CONSOLE_PREVIEW_ENABLED=true.
Open /preview/overview. Preview returns 404 otherwise, including when
CONSOLE_ENV=production. Use a dedicated preview deployment; never label a real
production deployment as preview. All records are synthetic and visibly marked.
Preview actions are in-memory only and never call a domain service. Case previews
are discarded on navigation. Exports explicitly say preview; report exports are
metadata, not claimed financial reports.

Production workspaces never substitute fixture data on failures. Missing staff
sessions and owner capabilities are displayed explicitly. Approvals, account
restrictions, credential issuance, financial recovery and production exports are
not enabled just because a button can be drawn.

## Integration boundary

The next PR supplies Keycloak login and server-side case reads. Each remaining
owner capability must be enabled only after its scoped staff API and audit
contract are implemented and tested. Keep banking, ledger and risk execution in
the owning services. This UI coverage is not evidence of completed live backend
integration.
