import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkflowHardener } from '../core/hardener.js';
import { WorkflowParser } from '../core/parser.js';

describe('WorkflowHardener Automated Repair Engine', () => {
  it('automatically injects permissions, concurrency, and timeouts into bare workflow', () => {
    const rawYaml = `
name: Bare CI

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm test
    `;

    const result = WorkflowHardener.harden(rawYaml);
    assert.ok(result.appliedFixes.length >= 3, 'Should apply at least 3 hardening fixes');

    // Parse the hardened result
    const hardenedParsed = WorkflowParser.parse(result.hardenedYaml);
    assert.ok(hardenedParsed.permissions, 'Hardened workflow has permissions block');
    assert.ok(hardenedParsed.concurrency?.cancelInProgress, 'Hardened workflow has concurrency cancellation');
    assert.strictEqual(hardenedParsed.jobs['build'].timeoutMinutes, 15);
    assert.ok(result.hardenedYaml.includes('actions/checkout@v4'), 'Upgraded to actions/checkout@v4');
  });

  it('preserves existing configurations when already compliant', () => {
    const compliantYaml = `
name: Compliant CI

on: [push]

permissions:
  contents: read

concurrency:
  group: pr-group
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - run: npm test
    `;

    const result = WorkflowHardener.harden(compliantYaml);
    assert.strictEqual(result.appliedFixes.length, 0, 'No modifications needed for compliant workflow');
  });
});
