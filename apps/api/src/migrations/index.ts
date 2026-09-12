import { PrepareConsoleDatabase1789159810000 } from './1789159810000-prepare-console-database';
import { CreateInvestigationCaseTable1789159811303 } from './1789159811303-create_investigation_cases_table';
import { ConsoleSessions1789165000000 } from './1789165000000-console-sessions';
import { AuditedCaseWorkflows1789167000000 } from './1789167000000-audited-case-workflows';

/** Shared by native Nest startup, integration tests and the serialized container startup runner. */
export const consoleMigrations = [
  PrepareConsoleDatabase1789159810000,
  CreateInvestigationCaseTable1789159811303,
  ConsoleSessions1789165000000,
  AuditedCaseWorkflows1789167000000,
];
