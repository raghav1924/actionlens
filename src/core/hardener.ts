import { WorkflowParser } from './parser.js';

export interface HardeningResult {
  hardenedYaml: string;
  appliedFixes: string[];
}

export class WorkflowHardener {
  /**
   * Automatically patches and hardens a GitHub Actions YAML workflow.
   */
  public static harden(rawYaml: string): HardeningResult {
    const appliedFixes: string[] = [];
    let updatedYaml = rawYaml;

    const parsed = WorkflowParser.parse(rawYaml);

    // 1. Upgrade deprecated action tags
    const upgrades = [
      { from: /actions\/checkout@v[123]/g, to: 'actions/checkout@v4', name: 'actions/checkout@v4' },
      { from: /actions\/setup-node@v[123]/g, to: 'actions/setup-node@v4', name: 'actions/setup-node@v4' },
      { from: /actions\/cache@v[123]/g, to: 'actions/cache@v4', name: 'actions/cache@v4' },
      { from: /actions\/upload-artifact@v[123]/g, to: 'actions/upload-artifact@v4', name: 'actions/upload-artifact@v4' },
      { from: /actions\/download-artifact@v[123]/g, to: 'actions/download-artifact@v4', name: 'actions/download-artifact@v4' },
    ];

    for (const up of upgrades) {
      if (up.from.test(updatedYaml)) {
        updatedYaml = updatedYaml.replace(up.from, up.to);
        appliedFixes.push(`Upgraded deprecated action to ${up.name}`);
      }
    }

    // 2. Add top-level permissions if missing
    if (parsed.permissions === undefined) {
      // Find insertion point right after `on:` block or at top
      const lines = updatedYaml.split(/\r?\n/);
      let insertIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('jobs:')) {
          insertIndex = i;
          break;
        }
      }

      if (insertIndex !== -1) {
        lines.splice(insertIndex, 0, 'permissions:', '  contents: read', '');
        updatedYaml = lines.join('\n');
        appliedFixes.push('Added least-privilege permissions block (contents: read)');
      }
    }

    // 3. Add concurrency cancellation if missing
    if (!parsed.concurrency?.cancelInProgress) {
      const lines = updatedYaml.split(/\r?\n/);
      let insertIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('jobs:')) {
          insertIndex = i;
          break;
        }
      }

      if (insertIndex !== -1) {
        lines.splice(insertIndex, 0, 'concurrency:', '  group: ${{ github.workflow }}-${{ github.ref }}', '  cancel-in-progress: true', '');
        updatedYaml = lines.join('\n');
        appliedFixes.push('Added concurrency cancellation group to eliminate redundant builds');
      }
    }

    // 4. Add timeout-minutes: 15 to jobs lacking timeouts
    const reParsed = WorkflowParser.parse(updatedYaml);
    for (const [jobId, job] of Object.entries(reParsed.jobs)) {
      if (!job.timeoutMinutes) {
        const lines = updatedYaml.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith(`${jobId}:`)) {
            // Insert timeout-minutes right under the job definition line
            const indent = lines[i].search(/\S/);
            const childIndent = ' '.repeat(indent + 2);
            lines.splice(i + 1, 0, `${childIndent}timeout-minutes: 15`);
            updatedYaml = lines.join('\n');
            appliedFixes.push(`Injected timeout-minutes: 15 into job '${jobId}'`);
            break;
          }
        }
      }
    }

    return {
      hardenedYaml: updatedYaml,
      appliedFixes,
    };
  }
}

