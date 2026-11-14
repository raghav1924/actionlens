import { AuditFinding, WorkflowAuditReport, WorkflowFile } from './types.js';
import { WorkflowGraph } from './graph.js';

export class WorkflowAuditor {
  /**
   * Run comprehensive security, performance, and reliability audit on a parsed WorkflowFile.
   */
  public static audit(workflow: WorkflowFile): WorkflowAuditReport {
    const findings: AuditFinding[] = [];

    // 1. Audit Workflow-level Concurrency (OPT-002)
    const hasConcurrency = Boolean(workflow.concurrency?.cancelInProgress);
    const triggers = Array.isArray(workflow.on) ? workflow.on : Object.keys(workflow.on || {});
    const isPrOrPush = triggers.includes('pull_request') || triggers.includes('push') || triggers.includes('pull_request_target');

    if (isPrOrPush && !hasConcurrency) {
      let anyJobHasConcurrency = false;
      for (const job of Object.values(workflow.jobs)) {
        if (job.concurrency?.cancelInProgress) anyJobHasConcurrency = true;
      }
      if (!anyJobHasConcurrency) {
        findings.push({
          id: 'OPT-002',
          title: 'Missing Concurrency Cancellation',
          category: 'PERFORMANCE',
          severity: 'MEDIUM',
          line: 1,
          message: 'Workflow runs on push/PR events without concurrency cancellation, causing wasteful duplicate runner runs when commits are pushed quickly.',
          remediation: 'Add concurrency group with cancel-in-progress: true to terminate obsolete builds.',
          autoFixSnippet: `concurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: true`,
        });
      }
    }

    // 2. Audit Workflow-level & Job-level Permissions (SEC-004)
    const hasTopLevelPermissions = workflow.permissions !== undefined;

    // 3. Audit Dangerous pull_request_target Trigger (SEC-002)
    const hasPrTarget = triggers.includes('pull_request_target');

    // 4. Audit Untargeted Push Trigger (REL-002)
    if (triggers.includes('push') && !Array.isArray(workflow.on) && typeof workflow.on === 'object') {
      const pushConfig = workflow.on['push'];
      if (!pushConfig || (typeof pushConfig === 'object' && !pushConfig['paths-ignore'] && !pushConfig['paths'] && !pushConfig['branches'])) {
        findings.push({
          id: 'REL-002',
          title: 'Unfiltered Push Trigger Runs on Markdown & Asset Commits',
          category: 'RELIABILITY',
          severity: 'LOW',
          line: 1,
          message: 'Workflow triggers on all pushes without paths or paths-ignore filtering, running heavy CI on non-code changes (docs, README).',
          remediation: "Add paths-ignore: ['**.md', 'docs/**'] to ignore documentation commits.",
          autoFixSnippet: "paths-ignore:\n  - '**.md'\n  - 'docs/**'",
        });
      }
    }

    // Iterate over Jobs
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      // SEC-004 Check permissions if no top level permissions
      if (!hasTopLevelPermissions && job.permissions === undefined) {
        findings.push({
          id: 'SEC-004',
          title: `Overly Permissive GITHUB_TOKEN on Job '${jobId}'`,
          category: 'SECURITY',
          severity: 'HIGH',
          jobId,
          line: job.line,
          message: `Job '${jobId}' has no explicit permissions block, defaulting to broad write permissions on repositories with default write workflows.`,
          remediation: 'Declare least-privilege permissions: contents: read at job or workflow level.',
          autoFixSnippet: `permissions:\n  contents: read`,
        });
      }

      // OPT-001 Check timeout-minutes
      if (!job.timeoutMinutes) {
        findings.push({
          id: 'OPT-001',
          title: `Missing Execution Timeout Ceiling on Job '${jobId}'`,
          category: 'PERFORMANCE',
          severity: 'MEDIUM',
          jobId,
          line: job.line,
          message: `Job '${jobId}' does not define timeout-minutes. A hung process or deadlock could consume up to 360 runner minutes (6 hours).`,
          remediation: 'Add timeout-minutes: 15 (or appropriate limit) to prevent runaway billing.',
          autoFixSnippet: `timeout-minutes: 15`,
        });
      }

      // Audit Steps in Job
      for (const step of job.steps) {
        // SEC-001: Script Injection Check
        if (step.run) {
          const dangerousVars = [
            'github.event.issue.title',
            'github.event.issue.body',
            'github.event.pull_request.title',
            'github.event.pull_request.body',
            'github.event.pull_request.head.ref',
            'github.event.comment.body',
            'github.head_ref',
          ];

          for (const dVar of dangerousVars) {
            const pattern = new RegExp(`\\$\\{\\{\\s*${dVar.replace(/\./g, '\\.')}\\s*\\}\\}`, 'i');
            if (pattern.test(step.run)) {
              findings.push({
                id: 'SEC-001',
                title: `Critical Script Injection Vulnerability in Step '${step.name || step.index}'`,
                category: 'SECURITY',
                severity: 'CRITICAL',
                jobId,
                stepIndex: step.index,
                stepName: step.name,
                line: step.line,
                message: `Step directly evaluates untrusted context '\${{ ${dVar} }}' inside inline shell script, allowing attackers to execute arbitrary bash commands via PR/Issue title or body.`,
                remediation: `Assign '\${{ ${dVar} }}' to an environment variable in env: and refer to $VAR safely inside the script.`,
                autoFixSnippet: `env:\n  INPUT_VAL: \${{ ${dVar} }}\nrun: |\n  echo "$INPUT_VAL"`,
              });
              break;
            }
          }

          // SEC-005: Raw Secret Exposure / Echo
          const secretEchoPattern = /echo\s+["']?\${{\s*secrets\.[a-zA-Z0-9_]+\s*}}["']?/i;
          if (secretEchoPattern.test(step.run)) {
            findings.push({
              id: 'SEC-005',
              title: `Unmasked Secret Logging in Step '${step.name || step.index}'`,
              category: 'SECURITY',
              severity: 'HIGH',
              jobId,
              stepIndex: step.index,
              stepName: step.name,
              line: step.line,
              message: 'Step prints secrets.* directly in echo command, risking terminal exposure or log scraping.',
              remediation: 'Remove direct echo statements of secrets. GitHub will mask known secrets, but mutated strings leak easily.',
            });
          }
        }

        // Action Usage Audits
        if (step.uses) {
          // SEC-002: Toxic pull_request_target with untrusted checkout
          if (hasPrTarget && step.uses.startsWith('actions/checkout')) {
            const refVal = step.with?.['ref'];
            if (typeof refVal === 'string' && (refVal.includes('head.sha') || refVal.includes('head.ref'))) {
              findings.push({
                id: 'SEC-002',
                title: `Toxic pull_request_target Untrusted Code Checkout`,
                category: 'SECURITY',
                severity: 'CRITICAL',
                jobId,
                stepIndex: step.index,
                stepName: step.name,
                line: step.line,
                message: `Workflow triggers on pull_request_target with privileged tokens but checks out untrusted code from PR head (${refVal}), granting attackers secret access.`,
                remediation: 'Use standard pull_request trigger, or separate untrusted test execution into an isolated read-only workflow.',
              });
            }
          }

          // SEC-003: Unpinned Third-Party Action
          const isThirdParty = !step.uses.startsWith('actions/') && !step.uses.startsWith('docker://') && !step.uses.startsWith('./');
          if (isThirdParty) {
            const atIndex = step.uses.indexOf('@');
            if (atIndex !== -1) {
              const version = step.uses.slice(atIndex + 1);
              const isSha = /^[a-f0-9]{40}$/i.test(version);
              if (!isSha) {
                findings.push({
                  id: 'SEC-003',
                  title: `Unpinned Third-Party Action '${step.uses}'`,
                  category: 'SECURITY',
                  severity: 'HIGH',
                  jobId,
                  stepIndex: step.index,
                  stepName: step.name,
                  line: step.line,
                  message: `Action references mutable ref '@${version}' instead of an immutable 40-character commit SHA. A compromised maintainer account or branch force-push can inject malware into your CI.`,
                  remediation: `Pin to full commit SHA (e.g. ${step.uses.split('@')[0]}@<sha> # ${version}).`,
                });
              }
            }
          }

          // OPT-004: Deprecated Action Version (v1, v2)
          const deprecatedPatterns = [
            { match: /^actions\/checkout@v[12]$/i, recommended: 'actions/checkout@v4' },
            { match: /^actions\/setup-node@v[12]$/i, recommended: 'actions/setup-node@v4' },
            { match: /^actions\/cache@v[12]$/i, recommended: 'actions/cache@v4' },
            { match: /^actions\/upload-artifact@v[123]$/i, recommended: 'actions/upload-artifact@v4' },
            { match: /^actions\/download-artifact@v[123]$/i, recommended: 'actions/download-artifact@v4' },
          ];

          for (const dep of deprecatedPatterns) {
            if (dep.match.test(step.uses)) {
              findings.push({
                id: 'OPT-004',
                title: `Deprecated Action Version '${step.uses}'`,
                category: 'RELIABILITY',
                severity: 'MEDIUM',
                jobId,
                stepIndex: step.index,
                stepName: step.name,
                line: step.line,
                message: `Action '${step.uses}' runs on obsolete Node runtimes that GitHub is deprecating or turning off.`,
                remediation: `Upgrade to modern release: ${dep.recommended}.`,
                autoFixSnippet: `uses: ${dep.recommended}`,
              });
            }
          }

          // OPT-003: Setup-Node Missing Cache
          if (step.uses.includes('actions/setup-node')) {
            const hasCache = Boolean(step.with?.['cache']);
            if (!hasCache) {
              findings.push({
                id: 'OPT-003',
                title: `Missing Dependency Cache in '${step.name || 'Setup Node'}'`,
                category: 'PERFORMANCE',
                severity: 'LOW',
                jobId,
                stepIndex: step.index,
                stepName: step.name,
                line: step.line,
                message: 'actions/setup-node is used without built-in caching, causing fresh dependency downloads on every runner spin-up.',
                remediation: "Add with: cache: 'npm' (or pnpm, yarn) to save 1-3 minutes per build.",
                autoFixSnippet: "with:\n  cache: 'npm'",
              });
            }
          }
        }
      }
    }

    // Build DAG
    const dagResult = WorkflowGraph.buildDag(workflow.jobs);

    // Compute Health Score (0 - 100)
    let score = 100;
    const stats = {
      totalJobs: Object.keys(workflow.jobs).length,
      totalSteps: Object.values(workflow.jobs).reduce((acc, j) => acc + j.steps.length, 0),
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    };

    for (const f of findings) {
      if (f.severity === 'CRITICAL') {
        score -= 30;
        stats.criticalCount++;
      } else if (f.severity === 'HIGH') {
        score -= 15;
        stats.highCount++;
      } else if (f.severity === 'MEDIUM') {
        score -= 8;
        stats.mediumCount++;
      } else if (f.severity === 'LOW') {
        score -= 3;
        stats.lowCount++;
      }
    }

    score = Math.max(0, Math.min(100, score));

    let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'A+';
    if (score >= 95) grade = 'A+';
    else if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';
    else grade = 'F';

    return {
      filePath: workflow.filePath,
      fileName: workflow.fileName,
      workflowName: workflow.name,
      score,
      grade,
      findings,
      stats,
      dag: {
        nodes: dagResult.nodes,
        criticalPath: dagResult.criticalPath,
        maxParallelJobs: dagResult.maxParallelJobs,
      },
    };
  }
}
