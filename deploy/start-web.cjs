'use strict';
const { validateRuntime } = require('./runtime-config.cjs');
try {
  validateRuntime(process.env, 'web');
  require('../apps/web/server.js');
} catch (error) {
  console.error(`Web startup failed: ${error.message}`);
  process.exitCode = 1;
}
