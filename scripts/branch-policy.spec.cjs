'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBranchPolicy } = require('./branch-policy.cjs');
const repo = 'Mobicred-v1/mobicred-console';
function event(head, base, headRepo = repo) {
  return { repository: { full_name: repo }, pull_request: {
    head: { ref: head, repo: { full_name: headRepo } },
    base: { ref: base, repo: { full_name: repo } },
  } };
}
for (const [head, base] of [['codex/feature', 'develop'], ['fix/regression', 'develop'], ['develop', 'staging'], ['staging', 'main']]) {
  test(`allows ${head} -> ${base}`, () => assert.ok(validateBranchPolicy(event(head, base))));
}
for (const [head, base] of [['feature/work', 'main'], ['feature/work', 'staging'], ['develop', 'main'], ['main', 'develop'], ['staging', 'develop'], ['develop', 'develop'], ['feature/work', 'another-feature']]) {
  test(`rejects ${head} -> ${base}`, () => assert.throws(() => validateBranchPolicy(event(head, base))));
}
test('rejects a fork pretending to be a promotion branch', () => {
  assert.throws(() => validateBranchPolicy(event('staging', 'main', 'other/fork')));
  assert.throws(() => validateBranchPolicy(event('develop', 'staging', 'other/fork')));
});
test('fails closed without complete event context', () => {
  for (const input of [null, {}, { pull_request: {} }, { ...event('staging', 'main'), repository: null }]) {
    assert.throws(() => validateBranchPolicy(input));
  }
});
