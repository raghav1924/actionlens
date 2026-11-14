import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkflowGraph } from '../core/graph.js';
import { WorkflowJob } from '../core/types.js';

describe('WorkflowGraph DAG & Topology Analyzer', () => {
  it('computes critical path and topological depth across dependent jobs', () => {
    const jobs: Record<string, WorkflowJob> = {
      lint: { id: 'lint', steps: [], line: 1 },
      unit_test: { id: 'unit_test', needs: ['lint'], steps: [], line: 5 },
      integration_test: { id: 'integration_test', needs: ['lint'], steps: [], line: 10 },
      e2e: { id: 'e2e', needs: ['unit_test', 'integration_test'], steps: [], line: 15 },
      deploy: { id: 'deploy', needs: ['e2e'], steps: [], line: 20 },
    };

    const dag = WorkflowGraph.buildDag(jobs);

    assert.strictEqual(dag.hasCycles, false);
    assert.strictEqual(dag.nodes.length, 5);
    assert.strictEqual(dag.criticalPath[0], 'lint');
    assert.strictEqual(dag.criticalPath[dag.criticalPath.length - 1], 'deploy');
    assert.strictEqual(dag.maxParallelJobs, 2); // unit_test & integration_test in parallel
  });

  it('detects circular job dependency deadlocks', () => {
    const cyclicJobs: Record<string, WorkflowJob> = {
      jobA: { id: 'jobA', needs: ['jobB'], steps: [], line: 1 },
      jobB: { id: 'jobB', needs: ['jobA'], steps: [], line: 5 },
    };

    const dag = WorkflowGraph.buildDag(cyclicJobs);
    assert.strictEqual(dag.hasCycles, true, 'Should detect circular dependency cycle');
  });

  it('generates valid Mermaid diagram syntax', () => {
    const jobs: Record<string, WorkflowJob> = {
      build: { id: 'build', name: 'Build App', steps: [], line: 1 },
      test: { id: 'test', name: 'Run Tests', needs: ['build'], steps: [], line: 5 },
    };

    const dag = WorkflowGraph.buildDag(jobs);
    assert.ok(dag.mermaid.startsWith('flowchart LR'));
    assert.ok(dag.mermaid.includes('build --> test'));
  });
});
