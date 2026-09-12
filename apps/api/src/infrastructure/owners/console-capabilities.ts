import { Controller, Get, Header, Req } from '@nestjs/common';
import type { StaffRequest, StaffActor } from '../../shared/auth/staff-auth.guard';
import { ownerOrigin } from './owner-read.transport';

type Environment = Record<string, string | undefined>;
export function consoleCapabilities(actor: StaffActor, env: Environment = process.env) {
  const permits = (key: string) => (env[key] ?? '').split(',').map((r) => r.trim()).filter(Boolean).some((r) => actor.roles.includes(r));
  let creditConfigured = false;
  try { ownerOrigin(env.CONSOLE_CREDIT_URL, env.NODE_ENV === 'production'); creditConfigured = true; } catch { /* no URL or secret in the response */ }
  const capability = (id: string, label: string, owner: string, enabled: boolean, configured: boolean, allowed: boolean) => ({
    id, label, owner, enabled, configured, granted: enabled && configured && allowed,
    status: !enabled ? 'Disabled' : !configured ? 'Not configured' : !allowed ? 'Not permitted' : 'Permitted',
    observation: 'Effective console policy only. This is not an owner-service health probe or a grant of owner permissions.',
  });
  return {
    tenantId: actor.tenantId, staffId: actor.staffId, roles: [...actor.roles], expiresAt: actor.expiresAt,
    observedAt: new Date().toISOString(),
    items: [
      capability('case-read', 'Investigation reads', 'Console', true, true, true),
      capability('case-write', 'Audited case commands', 'Console', env.CONSOLE_CASE_WORKFLOWS_ENABLED === 'true', true, permits('CONSOLE_CASE_WRITE_ROLES')),
      capability('case-audit', 'Case audit feed', 'Console', true, true, permits('CONSOLE_AUDIT_READ_ROLES')),
      capability('case-reports', 'Case workload reports', 'Console', true, true, permits('CONSOLE_CASE_REPORT_ROLES')),
      capability('credit-read', 'Credit evidence reads', 'Credit Intelligence', env.CONSOLE_CREDIT_READS_ENABLED === 'true', creditConfigured, permits('CONSOLE_CREDIT_READ_ROLES')),
      capability('ingestion-read', 'Ingestion quality reads', 'Credit Intelligence', env.CONSOLE_INGESTION_READS_ENABLED === 'true', creditConfigured, permits('CONSOLE_INGESTION_READ_ROLES')),
    ],
    unconnected: ['Customer staff reads', 'Payment owner reconciliation', 'Partner credential lifecycle', 'Alias directory', 'Staff directory', 'Owner configuration changes', 'Financial execution'],
  };
}

@Controller('console-capabilities')
export class ConsoleCapabilitiesController {
  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Req() request: StaffRequest) { return consoleCapabilities(request.staff!); }
}
