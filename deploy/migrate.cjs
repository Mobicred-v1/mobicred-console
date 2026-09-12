'use strict';
const { createRequire } = require('node:module');
const path = require('node:path');

/** Hold a dedicated PostgreSQL session lock across the entire migration transaction. */
async function runMigrations(url) {
  const fromApi = createRequire(path.join(__dirname, '../apps/api/package.json'));
  const { DataSource } = fromApi('typeorm');
  const { consoleMigrations } = require('../apps/api/dist/migrations/index.js');
  const database = new DataSource({
    type: 'postgres', url, ssl: false, synchronize: false, logging: false,
    migrations: consoleMigrations,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 120000 },
  });
  await database.initialize();
  const lock = database.createQueryRunner();
  let acquired = false;
  try {
    await lock.connect();
    const deadline = Date.now() + 120000;
    while (!acquired) {
      const rows = await lock.query('SELECT pg_try_advisory_lock(197921, 3005) AS acquired');
      acquired = rows[0]?.acquired === true;
      if (!acquired) {
        if (Date.now() >= deadline) throw new Error('Migration lock timeout');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    const applied = await database.runMigrations({ transaction: 'all' });
    console.log(`Database ready: ${applied.length} pending migration(s) applied`);
  } finally {
    try { if (acquired) await lock.query('SELECT pg_advisory_unlock(197921, 3005)'); }
    finally { await lock.release(); await database.destroy(); }
  }
}
module.exports = { runMigrations };
