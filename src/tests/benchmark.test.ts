import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkflowParser } from '../core/parser.js';
import { WorkflowAuditor } from '../core/auditor.js';
import { WorkflowGraph } from '../core/graph.js';
import { WorkflowJob } from '../core/types.js';

describe('Performance Benchmarks & High-Throughput Tests', () => {
  it('parses and audits 500 complex workflow definitions in under 100ms', () => {
    const rawYaml = `
name: High-Throughput CI Suite
on:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
  test:
    runs-on: ubuntu-latest
    needs: [lint]
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`;

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const parsed = WorkflowParser.parse(rawYaml);
      const report = WorkflowAuditor.audit(parsed);
      assert.strictEqual(report.score, 100);
    }
    const duration = performance.now() - start;

    assert.ok(duration < 300, `Auditing 500 workflows should take < 300ms, took ${duration.toFixed(2)}ms`);
  });

  it('computes topological DAG for 100 interconnected jobs in under 20ms', () => {
    const jobs: Record<string, WorkflowJob> = {};
    for (let i = 0; i < 100; i++) {
      const needs = i > 0 ? [`job_${i - 1}`] : [];
      jobs[`job_${i}`] = {
        id: `job_${i}`,
        name: `Job Number ${i}`,
        needs,
        steps: [],
        line: i + 1,
      };
    }

    const start = performance.now();
    const dag = WorkflowGraph.buildDag(jobs);
    const duration = performance.now() - start;

    assert.strictEqual(dag.nodes.length, 100);
    assert.strictEqual(dag.criticalPath.length, 100);
    assert.strictEqual(dag.hasCycles, false);
    assert.ok(duration < 50, `DAG computation took ${duration.toFixed(2)}ms`);
  });
});
