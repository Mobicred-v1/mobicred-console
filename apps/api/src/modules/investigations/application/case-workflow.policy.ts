import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { VerifiedStaff } from '../../../shared/auth/staff-token.policy';

export type CaseStatus = 'open' | 'waiting' | 'resolved';
export type CaseAction = 'assign_to_me' | 'set_status' | 'add_note';
const transitions: Record<CaseStatus, CaseStatus[]> = { open: ['waiting', 'resolved'], waiting: ['open', 'resolved'], resolved: ['open'] };

export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!transitions[from]?.includes(to)) throw new BadRequestException('Unsupported case transition. Resolved cases must be explicitly reopened.');
}
export function assertActor(actor: VerifiedStaff): void {
  if (!actor.staffId || !actor.tenantId) throw new ForbiddenException('Verified staff and tenant context required');
}
export function hasConfiguredRole(actor: VerifiedStaff, setting: string): boolean {
  const roles = (process.env[setting] ?? '').split(',').map((role) => role.trim()).filter(Boolean);
  return roles.length > 0 && actor.roles.some((role) => roles.includes(role));
}
export function idempotencyKey(value: string | undefined): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException('A UUID v4 Idempotency-Key is required');
  return value.toLowerCase();
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter((key) => row[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export function commandDigest(action: string, target: string | null, body: unknown): string {
  return createHash('sha256').update(canonical({ action, target, body })).digest('hex');
}
