import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WorkflowParser } from '../core/parser.js';
import { WorkflowAuditor } from '../core/auditor.js';
import { WorkflowHardener } from '../core/hardener.js';
import { WorkflowAuditReport } from '../core/types.js';

export class ActionLensStudio {
  private port: number;
  private targetDir: string;

  constructor(port = 5252, targetDir = process.cwd()) {
    this.port = port;
    this.targetDir = targetDir;
  }

  public start(): http.Server {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // API: Get Audit Reports
      if (url.pathname === '/api/audit' && req.method === 'GET') {
        const reports = this.scanWorkflows();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reports, targetDir: this.targetDir }));
        return;
      }

      // API: Harden Workflow
      if (url.pathname === '/api/harden' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            let contentToHarden = data.content;
            if (!contentToHarden && data.filePath && fs.existsSync(data.filePath)) {
              contentToHarden = fs.readFileSync(data.filePath, 'utf-8');
            }
            if (!contentToHarden) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No content or valid filePath provided' }));
              return;
            }

            const result = WorkflowHardener.harden(contentToHarden);
            if (data.save && data.filePath) {
              fs.writeFileSync(data.filePath, result.hardenedYaml, 'utf-8');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...result, saved: Boolean(data.save) }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Web Studio HTML
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderHtml());
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    server.listen(this.port, () => {
      console.log(`\n⚡ ActionLens Studio live at: \x1b[36mhttp://localhost:${this.port}\x1b[0m`);
    });

    return server;
  }

  public scanWorkflows(): WorkflowAuditReport[] {
    const workflowDir = path.join(this.targetDir, '.github', 'workflows');
    const reports: WorkflowAuditReport[] = [];

    if (!fs.existsSync(workflowDir)) {
      return reports;
    }

    const files = fs.readdirSync(workflowDir);
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const fullPath = path.join(workflowDir, file);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const parsed = WorkflowParser.parse(content, fullPath);
          const report = WorkflowAuditor.audit(parsed);
          reports.push(report);
        } catch (e) {
          // ignore parsing error in individual file
        }
      }
    }

    return reports;
  }

  private renderHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ActionLens — GitHub Actions Security & Optimizer Studio</title>
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: #11131a;
      --card-border: #1e2230;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --cyan: #06b6d4;
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #ef4444;
      --purple: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }
    .logo-group { display: flex; align-items: center; gap: 12px; }
    .badge {
      background: rgba(6, 182, 212, 0.15);
      color: var(--cyan);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
    .grid { display: grid; grid-template-columns: 320px 1fr; gap: 24px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
    }
    .file-item {
      padding: 12px 14px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      background: #141724;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .file-item:hover, .file-item.active {
      border-color: var(--cyan);
      background: rgba(6, 182, 212, 0.08);
    }
    .score-pill {
      font-weight: bold;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .score-A { background: rgba(16, 185, 129, 0.2); color: var(--emerald); }
    .score-B { background: rgba(245, 158, 11, 0.2); color: var(--amber); }
    .score-C, .score-F { background: rgba(239, 68, 68, 0.2); color: var(--rose); }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-box {
      background: #141724;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      text-align: center;
    }
    .stat-val { font-size: 24px; font-weight: bold; margin-top: 4px; }
    .finding-card {
      background: #141724;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .finding-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .sev-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .sev-CRITICAL { background: var(--rose); color: white; }
    .sev-HIGH { background: #f97316; color: white; }
    .sev-MEDIUM { background: var(--amber); color: black; }
    .sev-LOW { background: #3b82f6; color: white; }
    .code-block {
      background: #0d0f17;
      padding: 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      color: #38bdf8;
      margin-top: 8px;
      white-space: pre-wrap;
    }
    .btn {
      background: var(--cyan);
      color: #090a0f;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .dag-box {
      background: #0d0f17;
      padding: 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      color: #a7f3d0;
      margin-top: 14px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-group">
      <h1>⚡ ActionLens</h1>
      <span class="badge">CI/CD Studio v1.0.0</span>
    </div>
    <div>
      <span style="color: var(--text-muted); font-size: 14px;">Author: <a href="https://jatinsh.netlify.app/" target="_blank" style="color: var(--cyan); text-decoration: none; font-weight: 600;">Jatin Sharma</a></span>
    </div>
  </div>

  <div class="grid">
    <!-- Sidebar -->
    <div class="card">
      <h3 style="margin-bottom: 14px;">Workflows</h3>
      <div id="fileList">Loading workflows...</div>
      <button class="btn" style="width: 100%; margin-top: 16px;" onclick="loadData()">↻ Refresh Workflows</button>
    </div>

    <!-- Main View -->
    <div class="card" id="detailView">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 id="wfName">Select a workflow</h2>
          <p id="wfPath" style="color: var(--text-muted); font-size: 13px;"></p>
        </div>
        <button id="hardenBtn" class="btn" onclick="hardenSelected()" style="display: none;">🛡️ Auto-Harden Workflow</button>
      </div>

      <div class="stats-row">
        <div class="stat-box">
          <div style="color: var(--text-muted); font-size: 12px;">SECURITY SCORE</div>
          <div id="wfScore" class="stat-val">--</div>
        </div>
        <div class="stat-box">
          <div style="color: var(--text-muted); font-size: 12px;">CRITICAL RISKS</div>
          <div id="critCount" class="stat-val" style="color: var(--rose);">0</div>
        </div>
        <div class="stat-box">
          <div style="color: var(--text-muted); font-size: 12px;">TOTAL JOBS</div>
          <div id="jobCount" class="stat-val">0</div>
        </div>
        <div class="stat-box">
          <div style="color: var(--text-muted); font-size: 12px;">CRITICAL PATH</div>
          <div id="critPathCount" class="stat-val" style="color: var(--emerald);">0</div>
        </div>
      </div>

      <h3 style="margin: 20px 0 12px 0;">Pipeline Job Dependency DAG</h3>
      <div id="dagContainer" class="dag-box">No jobs loaded</div>

      <h3 style="margin: 24px 0 12px 0;">Audit Findings & Recommendations</h3>
      <div id="findingsContainer">No findings</div>
    </div>
  </div>

  <script>
    let currentReports = [];
    let selectedIdx = 0;

    async function loadData() {
      try {
        const res = await fetch('/api/audit');
        const data = await res.json();
        currentReports = data.reports || [];
        renderList();
        if (currentReports.length > 0) {
          selectWorkflow(0);
        } else {
          document.getElementById('wfName').innerText = 'No Workflows Detected in .github/workflows/';
        }
      } catch (err) {
        document.getElementById('fileList').innerText = 'Error loading workflows: ' + err.message;
      }
    }

    function renderList() {
      const el = document.getElementById('fileList');
      if (currentReports.length === 0) {
        el.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">No workflow YAML files found.</div>';
        return;
      }
      el.innerHTML = currentReports.map((r, i) => \`
        <div class="file-item \${i === selectedIdx ? 'active' : ''}" onclick="selectWorkflow(\${i})">
          <div>
            <div style="font-weight: 600; font-size: 14px;">\${r.fileName}</div>
            <div style="color: var(--text-muted); font-size: 11px;">\${r.workflowName}</div>
          </div>
          <span class="score-pill score-\${r.grade}">\${r.score}%</span>
        </div>
      \`).join('');
    }

    function selectWorkflow(idx) {
      selectedIdx = idx;
      renderList();
      const r = currentReports[idx];
      if (!r) return;

      document.getElementById('wfName').innerText = r.workflowName;
      document.getElementById('wfPath').innerText = r.filePath;
      document.getElementById('wfScore').innerText = r.score + '% (' + r.grade + ')';
      document.getElementById('critCount').innerText = r.stats.criticalCount;
      document.getElementById('jobCount').innerText = r.stats.totalJobs;
      document.getElementById('critPathCount').innerText = r.dag.criticalPath.length + ' jobs';
      document.getElementById('hardenBtn').style.display = 'block';

      // Render DAG
      const dagHtml = r.dag.nodes.map(n => {
        const critTag = n.isCriticalPath ? '<span style="color: var(--rose); font-weight: bold;">[CRITICAL PATH]</span> ' : '';
        const deps = n.dependsOn.length > 0 ? ' ← (' + n.dependsOn.join(', ') + ')' : ' (root)';
        return critTag + n.name + deps;
      }).join('\\n');
      document.getElementById('dagContainer').innerText = dagHtml || 'Single job standalone workflow.';

      // Render Findings
      const fc = document.getElementById('findingsContainer');
      if (r.findings.length === 0) {
        fc.innerHTML = '<div style="color: var(--emerald); font-weight: 600;">✨ Zero vulnerabilities or optimization issues found! Excellent workflow hygiene.</div>';
      } else {
        fc.innerHTML = r.findings.map(f => \`
          <div class="finding-card">
            <div class="finding-header">
              <span class="sev-tag sev-\${f.severity}">\${f.severity}</span>
              <span style="font-family: monospace; font-size: 12px; color: var(--text-muted);">\${f.id} \${f.line ? '• Line ' + f.line : ''}</span>
            </div>
            <h4 style="margin-bottom: 6px;">\${f.title}</h4>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">\${f.message}</p>
            <div style="font-size: 12px; color: var(--emerald);"><strong>Fix:</strong> \${f.remediation}</div>
            \${f.autoFixSnippet ? '<div class="code-block">' + f.autoFixSnippet + '</div>' : ''}
          </div>
        \`).join('');
      }
    }

    async function hardenSelected() {
      const r = currentReports[selectedIdx];
      if (!r) return;
      if (!confirm('Apply automated security and performance fixes to ' + r.fileName + '?')) return;

      try {
        const res = await fetch('/api/harden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: r.filePath, save: true })
        });
        const result = await res.json();
        alert('Applied fixes:\\n• ' + result.appliedFixes.join('\\n• '));
        loadData();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    window.onload = loadData;
  </script>
</body>
</html>`;
  }
}

