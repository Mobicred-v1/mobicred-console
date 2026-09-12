'use strict';
const { validateRuntime, databaseUrl } = require('./runtime-config.cjs');
const { runMigrations } = require('./migrate.cjs');

(async () => {
  try {
    validateRuntime(process.env, 'api');
    process.env.DATABASE_URL = databaseUrl(process.env);
  } catch (error) {
    console.error(`Deployment configuration: ${error.message}`); // Messages contain variable names, never values.
    process.exitCode = 1;
    return;
  }
  try { await runMigrations(process.env.DATABASE_URL); }
  catch {
    console.error('Migration failed. API not started. Check database readiness/credentials and the committed migration history. No automatic rollback or schema synchronization is attempted.');
    process.exitCode = 1;
    return;
  }
  // The serialized startup runner already applied migrations. Nest must not race it.
  process.env.CONSOLE_RUN_MIGRATIONS = 'false';
  require('../apps/api/dist/main.js');
})();
