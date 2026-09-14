import { Controller, Get, Header, Req } from '@nestjs/common';
import type { StaffRequest, StaffActor } from '../../shared/auth/staff-auth.guard';
import { ownerOrigin } from './owner-read.transport';
type Environment = Record<string, string | undefined>;
export function consoleCapabilities(actor: StaffActor, env: Environment = process.env) {
  const permits = (key: string) => (env[key] ?? '').split(',').map((r) => r.trim()).filter(Boolean).some((r) => actor.roles.includes(r));
  const configured = (key: string) => { try { ownerOrigin(env[key], env.NODE_ENV === 'production'); return true; } catch { return false; } };
  const capability = (id: string, label: string, owner: string, enabled: boolean, ready: boolean, allowed: boolean) => ({ id, label, owner, enabled, configured: ready, granted: enabled && ready && allowed, status: !enabled ? 'Disabled' : !ready ? 'Not configured' : !allowed ? 'Not permitted' : 'Permitted', observation: 'Effective console policy. Owner permissions and service reachability are verified separately.' });
  return { tenantId: actor.tenantId, staffId: actor.staffId, roles: [...actor.roles], expiresAt: actor.expiresAt, observedAt: new Date().toISOString(), items: [
    capability('case-read', 'Investigation reads', 'Mobicred', true, true, true),
    capability('case-write', 'Audited case commands', 'Mobicred', env.CONSOLE_CASE_WORKFLOWS_ENABLED === 'true', true, permits('CONSOLE_CASE_WRITE_ROLES')),
    capability('case-audit', 'Case audit feed', 'Mobicred', true, true, permits('CONSOLE_AUDIT_READ_ROLES')),
    capability('case-reports', 'Case workload reports', 'Mobicred', true, true, permits('CONSOLE_CASE_REPORT_ROLES')),
    capability('credit-read', 'Credit evidence reads', 'Credit Intelligence', env.CONSOLE_CREDIT_READS_ENABLED === 'true', configured('CONSOLE_CREDIT_URL'), permits('CONSOLE_CREDIT_READ_ROLES')),
    capability('ingestion-read', 'Ingestion quality reads', 'Credit Intelligence', env.CONSOLE_INGESTION_READS_ENABLED === 'true', configured('CONSOLE_CREDIT_URL'), permits('CONSOLE_INGESTION_READ_ROLES')),
    capability('partner-read', 'Partner administration', 'Core', true, configured('CONSOLE_CORE_URL'), actor.roles.some((r) => ['ADMIN', 'OPS'].includes(r))),
    capability('partner-credentials', 'Partner credential lifecycle', 'Core', true, configured('CONSOLE_CORE_URL'), actor.roles.includes('ADMIN')),
  ], unconnected: ['Payment reconciliation commands', 'Alias directory', 'Staff directory', 'Owner configuration changes', 'Financial execution'] };
}
@Controller('console-capabilities')
export class ConsoleCapabilitiesController {
  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Req() request: StaffRequest) { return consoleCapabilities(request.staff!); }
}
