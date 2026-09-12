'use strict';
const assert = require('node:assert/strict');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const config = JSON.parse(input);
  assert.deepEqual(Object.keys(config.services).sort(), ['api', 'postgres', 'web']);
  for (const [name, service] of Object.entries(config.services)) {
    assert.ok(!service.ports?.length, `${name}: production must not publish host ports`);
    assert.ok(!service.container_name, `${name}: no cross-resource container-name collisions`);
    assert.ok(service.healthcheck?.test?.length, `${name}: readiness required`);
    assert.equal(service.restart, 'unless-stopped');
    assert.ok(!service.build?.args, `${name}: no secrets supplied as build arguments`);
  }
  for (const name of ['web', 'api']) {
    const service = config.services[name];
    assert.equal(service.build.target, name);
    assert.equal(service.environment.NODE_ENV, 'production');
    assert.equal(service.environment.CONSOLE_ENV, 'production');
    assert.equal(service.environment.CONSOLE_PREVIEW_ENABLED, 'false');
    assert.equal(service.read_only, true);
    assert.ok(service.cap_drop.includes('ALL'));
  }
  assert.equal(config.services.api.depends_on.postgres.condition, 'service_healthy');
  assert.equal(config.services.web.depends_on.api.condition, 'service_healthy');
  assert.equal(config.services.web.environment.CONSOLE_API_URL, 'http://api:3005');
  assert.ok(!('DATABASE_PASSWORD' in config.services.web.environment));
  assert.ok(!('CONSOLE_SESSION_ENCRYPTION_KEY' in config.services.web.environment));
  assert.ok(!('CONSOLE_LOGIN_COOKIE_KEY' in config.services.api.environment));
  const volume = config.services.postgres.volumes.find((v) => v.type === 'volume');
  assert.equal(volume.target, '/var/lib/postgresql/data');
  console.log('PASS: one production stack, ordered readiness, no published host ports, scoped credentials, named database volume.');
});
