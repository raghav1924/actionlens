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
});
