import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkflowParser } from '../core/parser.js';
import { WorkflowAuditor } from '../core/auditor.js';

describe('WorkflowAuditor Security & Performance Heuristics', () => {
  it('detects critical script injection vulnerabilities in run steps', () => {
    const yaml = `
      name: Issue Processor
      on: issues
      jobs:
        handle:
          runs-on: ubuntu-latest
          timeout-minutes: 5
          permissions:
            contents: read
          steps:
            - run: echo "Title is \${{ github.event.issue.title }}"
    `;
    const parsed = WorkflowParser.parse(yaml);
    const report = WorkflowAuditor.audit(parsed);

    const injection = report.findings.find(f => f.id === 'SEC-001');
    assert.ok(injection, 'Should detect SEC-001 script injection');
    assert.strictEqual(injection?.severity, 'CRITICAL');
  });

  it('detects toxic pull_request_target with untrusted checkout', () => {
    const yaml = `
      name: Toxic PR Target
      on: pull_request_target
      jobs:
        test:
          runs-on: ubuntu-latest
          timeout-minutes: 10
          permissions:
            contents: write
          steps:
            - uses: actions/checkout@v4
              with:
                ref: \${{ github.event.pull_request.head.sha }}
    `;
    const parsed = WorkflowParser.parse(yaml);
    const report = WorkflowAuditor.audit(parsed);

    const toxic = report.findings.find(f => f.id === 'SEC-002');
    assert.ok(toxic, 'Should detect SEC-002 toxic pull_request_target checkout');
    assert.strictEqual(toxic?.severity, 'CRITICAL');
  });

  it('flags unpinned mutable third-party actions and deprecated runtimes', () => {
    const yaml = `
      name: Linter
      on: push
      jobs:
        lint:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v2
            - uses: dangerousorg/super-linter@v1
    `;
    const parsed = WorkflowParser.parse(yaml);
    const report = WorkflowAuditor.audit(parsed);

    assert.ok(report.findings.some(f => f.id === 'SEC-003'), 'Flags unpinned third-party action');
    assert.ok(report.findings.some(f => f.id === 'OPT-004'), 'Flags deprecated v2 action version');
  });

  it('verifies hardened clean workflow receives A+ grade with zero critical findings', () => {
    const yaml = `
      name: Clean CI
      on:
        push:
          branches: [main]
          paths-ignore: ['**.md']
      permissions:
        contents: read
      concurrency:
        group: ci-\${{ github.ref }}
        cancel-in-progress: true
      jobs:
        build:
          runs-on: ubuntu-latest
          timeout-minutes: 10
          steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                node-version: 22
                cache: 'npm'
            - run: npm test
    `;
    const parsed = WorkflowParser.parse(yaml);
    const report = WorkflowAuditor.audit(parsed);

    assert.strictEqual(report.stats.criticalCount, 0);
    assert.strictEqual(report.stats.highCount, 0);
    assert.strictEqual(report.grade, 'A+');
    assert.strictEqual(report.score, 100);
  });

  it('produces valid JSON-serializable report objects', () => {
    const yaml = `
      name: Sample
      jobs:
        sample:
          steps:
            - run: echo "hello"
    `;
    const parsed = WorkflowParser.parse(yaml);
    const report = WorkflowAuditor.audit(parsed);
    const serialized = JSON.stringify(report);
    assert.ok(serialized.length > 50);
    const parsedBack = JSON.parse(serialized);
    assert.strictEqual(parsedBack.workflowName, 'Sample');
    assert.ok(Array.isArray(parsedBack.findings));
  });

  it('flags unfiltered push triggers that run on documentation changes', () => {
    const yaml = `
      name: Bare Push
      on:
        push: {}
      jobs:
        test:
          runs-on: ubuntu-latest
          steps:
            - run: npm test
    `;
    const parsed = WorkflowParser.parse(yaml);
    const report = WorkflowAuditor.audit(parsed);
    assert.ok(report.findings.some(f => f.id === 'REL-002'), 'Flags bare push trigger without paths filter');
  });
});

