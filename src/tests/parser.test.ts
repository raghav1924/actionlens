import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkflowParser } from '../core/parser.js';

describe('WorkflowParser AST & YAML Lexer', () => {
  it('parses workflow triggers and permissions correctly', () => {
    const yaml = `
      name: CI Suite
      on:
        push:
          branches: [main]
      permissions:
        contents: read
        pull-requests: write
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - run: npm test
    `;
    const parsed = WorkflowParser.parse(yaml);
    assert.strictEqual(parsed.name, 'CI Suite');
    assert.ok(parsed.jobs['build']);
    const perms = parsed.permissions as Record<string, string>;
    assert.strictEqual(perms?.['contents'], 'read');
    assert.strictEqual(perms?.['pull-requests'], 'write');
  });

  it('extracts multi-job dependencies and needs arrays', () => {
    const yaml = `
      jobs:
        lint:
          runs-on: ubuntu-latest
          steps:
            - run: npm run lint
        test:
          needs: [lint]
          runs-on: ubuntu-latest
          steps:
            - run: npm test
        deploy:
          needs: test
          runs-on: ubuntu-latest
          steps:
            - run: ./deploy.sh
    `;
    const parsed = WorkflowParser.parse(yaml);
    assert.deepStrictEqual(parsed.jobs['test'].needs, ['lint']);
    assert.deepStrictEqual(parsed.jobs['deploy'].needs, ['test']);
  });

  it('handles multi-line run scripts and inline step properties', () => {
    const yaml = `
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - name: Compile and Test
              id: step_compile
              timeout-minutes: 10
              run: |
                npm ci
                npm run build
                npm test
    `;
    const parsed = WorkflowParser.parse(yaml);
    const step = parsed.jobs['build'].steps[0];
    assert.strictEqual(step.name, 'Compile and Test');
    assert.strictEqual(step.id, 'step_compile');
    assert.strictEqual(step.timeoutMinutes, 10);
    assert.ok(step.run?.includes('npm ci'));
    assert.ok(step.run?.includes('npm test'));
  });

  it('parses strategy matrix dimensions accurately', () => {
    const yaml = `
      jobs:
        matrix_test:
          runs-on: ubuntu-latest
          strategy:
            matrix:
              node: [18, 20, 22]
              os: [ubuntu-latest, macos-latest]
          steps:
            - run: node -v
    `;
    const parsed = WorkflowParser.parse(yaml);
    const job = parsed.jobs['matrix_test'];
    assert.ok(job.matrix);
    assert.deepStrictEqual(job.matrix!['node'], [18, 20, 22]);
    assert.deepStrictEqual(job.matrix!['os'], ['ubuntu-latest', 'macos-latest']);
  });

  it('normalizes string and object concurrency syntax properly', () => {
    const stringConcurrencyYaml = `
      name: String Concurrency
      concurrency: my-ci-queue
      jobs:
        test:
          steps:
            - run: npm test
    `;
    const parsedStr = WorkflowParser.parse(stringConcurrencyYaml);
    assert.strictEqual(parsedStr.concurrency?.group, 'my-ci-queue');
    assert.strictEqual(parsedStr.concurrency?.cancelInProgress, false);

    const objectConcurrencyYaml = `
      name: Object Concurrency
      concurrency:
        group: pr-\${{ github.ref }}
        cancel-in-progress: true
      jobs:
        test:
          steps:
            - run: npm test
    `;
    const parsedObj = WorkflowParser.parse(objectConcurrencyYaml);
    assert.strictEqual(parsedObj.concurrency?.group, 'pr-${{ github.ref }}');
    assert.strictEqual(parsedObj.concurrency?.cancelInProgress, true);
  });
});
