import fs from 'node:fs';
import path from 'node:path';
import { WorkflowParser } from './core/parser.js';
import { WorkflowAuditor } from './core/auditor.js';
import { WorkflowHardener } from './core/hardener.js';
import { WorkflowGraph } from './core/graph.js';
import { ActionLensStudio } from './server/studio.js';
import { Logger, colors } from './utils/logger.js';

export function runCli(args: string[]): void {
  const command = args[0] || 'help';

  switch (command) {
    case 'audit':
    case 'scan':
    case 'check':
      handleAudit(args.slice(1));
      break;

    case 'fix':
    case 'harden':
      handleHarden(args.slice(1));
      break;

    case 'dag':
    case 'graph':
      handleDag(args.slice(1));
      break;

    case 'studio':
    case 'ui':
      handleStudio(args.slice(1));
      break;

    case 'version':
    case '-v':
    case '--version':
      console.log('ActionLens v1.0.0 — Crafted by Jatin Sharma (https://jatinsh.netlify.app/)');
      break;

    case 'help':
    case '--help':
    default:
      printHelp();
      break;
  }
}

function handleAudit(args: string[]): void {
  const targetPath = args.find(a => !a.startsWith('-')) || process.cwd();
  const minScoreArg = args.find(a => a.startsWith('--min-score='));
  const minScore = minScoreArg ? parseInt(minScoreArg.split('=')[1], 10) : 75;
  const failOnSec = args.includes('--fail-on-sec') || args.includes('--fail-on-critical');
  const jsonOutput = args.includes('--json');

  let filesToScan: string[] = [];

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    filesToScan.push(targetPath);
  } else {
    const wfDir = path.join(targetPath, '.github', 'workflows');
    if (fs.existsSync(wfDir)) {
      filesToScan = fs.readdirSync(wfDir)
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map(f => path.join(wfDir, f));
    }
  }

  if (filesToScan.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: 'No GitHub Actions workflows found', reports: [] }));
    } else {
      Logger.warn(`No GitHub Actions workflow files (.yml / .yaml) found in ${targetPath}`);
    }
    return;
  }

  const reports = [];
  let hasCriticalSecurityFailure = false;
  let hasScoreFailure = false;

  if (!jsonOutput) {
    Logger.header('ActionLens — GitHub Actions Workflow Audit');
    console.log(`${colors.gray}Target: ${path.resolve(targetPath)}${colors.reset}\n`);
  }

  for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf-8');
    const parsed = WorkflowParser.parse(content, file);
    const report = WorkflowAuditor.audit(parsed);
    reports.push(report);

    if (report.stats.criticalCount > 0 && failOnSec) {
      hasCriticalSecurityFailure = true;
    }
    if (report.score < minScore) {
      hasScoreFailure = true;
    }

    if (!jsonOutput) {
      const scoreColor = report.score >= 85 ? colors.green : report.score >= 70 ? colors.yellow : colors.red;
      console.log(`${colors.bold}${report.fileName}${colors.reset} • ${scoreColor}${report.score}% [${report.grade}]${colors.reset}`);
      console.log(`  Workflow: ${report.workflowName} | Jobs: ${report.stats.totalJobs} | Steps: ${report.stats.totalSteps}`);

      if (report.findings.length === 0) {
        console.log(`  ${colors.green}✔ No security or performance issues detected.${colors.reset}\n`);
      } else {
        console.log(`  Findings: ${report.stats.criticalCount} Critical, ${report.stats.highCount} High, ${report.stats.mediumCount} Medium, ${report.stats.lowCount} Low`);
        for (const f of report.findings) {
          const sevColor = f.severity === 'CRITICAL' ? colors.red : f.severity === 'HIGH' ? colors.yellow : colors.cyan;
          console.log(`    ${sevColor}[${f.severity}]${colors.reset} ${colors.bold}${f.id}${colors.reset}: ${f.title} (Line ${f.line || '?'})`);
          console.log(`      ${colors.gray}${f.message}${colors.reset}`);
          console.log(`      ${colors.green}Fix: ${f.remediation}${colors.reset}`);
        }
        console.log('');
      }
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ reports }, null, 2));
  } else {
    Logger.divider();
    console.log(`Audited ${reports.length} workflow file(s).`);
  }

  if (hasCriticalSecurityFailure || hasScoreFailure) {
    if (!jsonOutput) {
      Logger.error(`Audit failed quality gates! (Min Score: ${minScore}%, Fail-On-Security: ${failOnSec})`);
    }
    process.exit(1);
  }
}

function handleHarden(args: string[]): void {
  const filePath = args.find(a => !a.startsWith('-'));
  if (!filePath || !fs.existsSync(filePath)) {
    Logger.error('Please specify an existing workflow file to harden (e.g. actionlens fix .github/workflows/ci.yml)');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = WorkflowHardener.harden(content);

  if (result.appliedFixes.length === 0) {
    Logger.success(`Workflow '${path.basename(filePath)}' is already properly hardened! Zero automated fixes needed.`);
    return;
  }

  fs.writeFileSync(filePath, result.hardenedYaml, 'utf-8');
  Logger.header(`ActionLens — Automated Workflow Hardening`);
  Logger.success(`Updated ${filePath} with ${result.appliedFixes.length} security/performance fix(es):`);
  for (const fix of result.appliedFixes) {
    console.log(`  ${colors.green}✔${colors.reset} ${fix}`);
  }
}

function handleDag(args: string[]): void {
  const filePath = args.find(a => !a.startsWith('-'));
  if (!filePath || !fs.existsSync(filePath)) {
    Logger.error('Please specify an existing workflow file (e.g. actionlens dag .github/workflows/ci.yml)');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = WorkflowParser.parse(content, filePath);
  const dag = WorkflowGraph.buildDag(parsed.jobs);

  Logger.header(`Job Dependency DAG: ${parsed.name}`);
  console.log(`Total Jobs: ${dag.nodes.length} | Max Parallel Jobs: ${dag.maxParallelJobs}`);
  console.log(`Critical Path: ${colors.bold}${dag.criticalPath.join(' ➔ ') || 'None'}${colors.reset}\n`);

  console.log(`${colors.cyan}Mermaid Diagram Syntax:${colors.reset}`);
  console.log(dag.mermaid);
}

function handleStudio(args: string[]): void {
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 5252;
  const targetDir = args.find(a => !a.startsWith('-')) || process.cwd();

  const studio = new ActionLensStudio(port, targetDir);
  studio.start();
}

function printHelp(): void {
  console.log(`
${colors.bold}${colors.magenta}⚡ ActionLens — GitHub Actions Workflow Linter & Pipeline Studio${colors.reset}
${colors.gray}Crafted by Jatin Sharma (https://jatinsh.netlify.app/) • GitHub: @raghav1924${colors.reset}

${colors.bold}USAGE:${colors.reset}
  $ actionlens <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.cyan}audit${colors.reset} [dir|file]        Audit workflows for security vulnerabilities and CI bloat
  ${colors.cyan}fix${colors.reset} <file>              Auto-harden workflow file (timeouts, permissions, concurrency)
  ${colors.cyan}dag${colors.reset} <file>              Compute and print job dependency topology & critical path
  ${colors.cyan}studio${colors.reset} [--port=5252]     Launch interactive dark-mode Web Studio on localhost
  ${colors.cyan}version${colors.reset}                 Print version information
  ${colors.cyan}help${colors.reset}                    Show this help message

${colors.bold}OPTIONS:${colors.reset}
  ${colors.yellow}--min-score=<n>${colors.reset}      Minimum acceptable health score (default: 75)
  ${colors.yellow}--fail-on-sec${colors.reset}        Exit with code 1 if any CRITICAL security flaw exists
  ${colors.yellow}--json${colors.reset}               Output machine-readable JSON for CI integration

${colors.bold}EXAMPLES:${colors.reset}
  $ actionlens audit . --min-score=85 --fail-on-sec
  $ actionlens fix .github/workflows/ci.yml
  $ actionlens studio --port=5252
`);
}
