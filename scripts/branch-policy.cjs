'use strict';

/** Pure routing policy; no credentials, network calls or repository mutations. */
function validateBranchPolicy(event) {
  const pr = event?.pull_request;
  if (!pr) throw new Error('Pull request context is required');
  const base = pr.base?.ref;
  const head = pr.head?.ref;
  const repository = event.repository?.full_name;
  if (!repository || !base || !head || pr.base?.repo?.full_name !== repository) {
    throw new Error('Complete repository and branch context is required');
  }
  if (base === 'develop') {
    if (['develop', 'staging', 'main'].includes(head)) {
      throw new Error('Implementation PRs into develop must use a feature/fix branch');
    }
    return 'feature -> develop';
  }
  const expected = { staging: 'develop', main: 'staging' }[base];
  if (!expected || head !== expected || pr.head?.repo?.full_name !== repository) {
    throw new Error('Required flow: feature -> develop -> staging -> main (same-repository promotions)');
  }
  return `${head} -> ${base}`;
}

module.exports = { validateBranchPolicy };
if (require.main === module) {
  try {
    const fs = require('node:fs');
    const path = process.env.GITHUB_EVENT_PATH;
    if (!path) throw new Error('GITHUB_EVENT_PATH is required');
    const event = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log(`PASS: ${validateBranchPolicy(event)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid PR context');
    process.exitCode = 1;
  }
}
