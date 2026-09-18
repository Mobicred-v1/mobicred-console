import type { StaffSession } from './session-model';
/** Include identity/permissions as well as scope: cached views cannot restore older grants. */
export function sessionRevision(session: StaffSession): string {
  return JSON.stringify([session.staffId ?? session.name, session.contextVersion ?? 0,
    session.partnerContext?.partnerCode ?? null, session.partnerContext?.tenantId ?? null,
    [...session.roles].sort(), session.expiresAt]);
}
export function isCurrentView(view: StaffSession, current: StaffSession, now = Date.now()): boolean {
  return (view.expiresAt ?? 0) > now && sessionRevision(view) === sessionRevision(current);
}
