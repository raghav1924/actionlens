import { WorkflowFile, WorkflowJob, WorkflowStep } from './types.js';

interface RawLine {
  lineNum: number;
  indent: number;
  text: string;
}

export class WorkflowParser {
  /**
   * Parse raw GitHub Actions YAML content into a structured WorkflowFile AST.
   */
  public static parse(rawContent: string, filePath = '.github/workflows/workflow.yml'): WorkflowFile {
    const rawLines = rawContent.split(/\r?\n/);
    const fileName = filePath.split(/[/\\]/).pop() || 'workflow.yml';

    const parsedYaml = this.parseYaml(rawContent);

    // Extract top-level name
    const workflowName = typeof parsedYaml['name'] === 'string' ? parsedYaml['name'] : fileName.replace(/\.ya?ml$/, '');

    // Extract triggers (on)
    let triggers: any = parsedYaml['on'] || {};
    if (typeof triggers === 'string') {
      triggers = [triggers];
    }

    // Extract top-level permissions
    const permissions = parsedYaml['permissions'];

    // Extract top-level concurrency
    let concurrency: any = undefined;
    if (parsedYaml['concurrency']) {
      if (typeof parsedYaml['concurrency'] === 'string') {
        concurrency = { group: parsedYaml['concurrency'], cancelInProgress: false };
      } else if (typeof parsedYaml['concurrency'] === 'object') {
        concurrency = {
          group: parsedYaml['concurrency']['group'] || 'default',
          cancelInProgress: Boolean(parsedYaml['concurrency']['cancel-in-progress'] ?? parsedYaml['concurrency']['cancelInProgress']),
        };
      }
    }

    // Extract jobs
    const jobs: Record<string, WorkflowJob> = {};
    const rawJobs = parsedYaml['jobs'] || {};

    if (typeof rawJobs === 'object' && rawJobs !== null) {
      for (const [jobId, jobData] of Object.entries<any>(rawJobs)) {
        if (!jobData || typeof jobData !== 'object') continue;

        // Locate job definition line in raw lines
        const jobLine = this.findKeyLine(rawLines, jobId, 'jobs');

        // Parse job needs
        let needs: string[] = [];
        if (jobData['needs']) {
          if (Array.isArray(jobData['needs'])) {
            needs = jobData['needs'].map(String);
          } else if (typeof jobData['needs'] === 'string') {
            needs = [jobData['needs']];
          }
        }

        // Parse timeout-minutes
        const timeoutMinutes = jobData['timeout-minutes'] ? Number(jobData['timeout-minutes']) : undefined;

        // Parse job concurrency
        let jobConcurrency: any = undefined;
        if (jobData['concurrency']) {
          if (typeof jobData['concurrency'] === 'string') {
            jobConcurrency = { group: jobData['concurrency'], cancelInProgress: false };
          } else if (typeof jobData['concurrency'] === 'object') {
            jobConcurrency = {
              group: jobData['concurrency']['group'] || 'default',
              cancelInProgress: Boolean(jobData['concurrency']['cancel-in-progress'] ?? jobData['concurrency']['cancelInProgress']),
            };
          }
        }

        // Parse steps
        const steps: WorkflowStep[] = [];
        const rawSteps = Array.isArray(jobData['steps']) ? jobData['steps'] : [];

        for (let i = 0; i < rawSteps.length; i++) {
          const s = rawSteps[i];
          if (!s || typeof s !== 'object') continue;

          const stepLine = this.findStepLine(rawLines, s, jobLine);

          steps.push({
            index: i,
            id: s['id'] ? String(s['id']) : undefined,
            name: s['name'] ? String(s['name']) : undefined,
            uses: s['uses'] ? String(s['uses']) : undefined,
            run: s['run'] ? String(s['run']) : undefined,
            with: typeof s['with'] === 'object' ? s['with'] : undefined,
            env: typeof s['env'] === 'object' ? s['env'] : undefined,
            if: s['if'] ? String(s['if']) : undefined,
            continueOnError: Boolean(s['continue-on-error']),
            timeoutMinutes: s['timeout-minutes'] ? Number(s['timeout-minutes']) : undefined,
            line: stepLine,
          });
        }

        jobs[jobId] = {
          id: jobId,
          name: jobData['name'] ? String(jobData['name']) : jobId,
          runsOn: jobData['runs-on'] || 'ubuntu-latest',
          needs,
          timeoutMinutes,
          concurrency: jobConcurrency,
          permissions: jobData['permissions'],
          environment: jobData['environment'] ? String(jobData['environment']) : undefined,
          matrix: jobData['strategy']?.['matrix'] || undefined,
          steps,
          line: jobLine,
        };
      }
    }

    return {
      filePath,
      fileName,
      name: workflowName,
      on: triggers,
      permissions,
      concurrency,
      jobs,
      rawContent,
      lines: rawLines,
    };
  }

  public static stripCommonIndent(content: string): string {
    const lines = content.split(/\r?\n/);
    const nonEmpties = lines.filter(l => l.trim().length > 0);
    if (nonEmpties.length === 0) return content;
    const minIndent = Math.min(...nonEmpties.map(l => l.search(/\S/)));
    if (minIndent <= 0) return content;
    return lines.map(l => (l.length >= minIndent ? l.slice(minIndent) : l)).join('\n');
  }

  /**
   * Lightweight, robust YAML subset parser for GitHub Actions workflows.
   */
  public static parseYaml(content: string): Record<string, any> {
    content = this.stripCommonIndent(content);
    const lines = content.split(/\r?\n/);
    const cleaned: RawLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);
      cleaned.push({ lineNum: i + 1, indent, text: line.trim() });
    }

    let cursor = 0;

    function parseBlock(currentIndent: number): any {
      const isList = cleaned[cursor] && cleaned[cursor].text.startsWith('-');

      if (isList) {
        const listResult: any[] = [];
        while (cursor < cleaned.length && cleaned[cursor].indent === currentIndent && cleaned[cursor].text.startsWith('-')) {
          const itemText = cleaned[cursor].text.slice(1).trim();
          cursor++;

          if (itemText === '') {
            // Nested list item object or value
            if (cursor < cleaned.length && cleaned[cursor].indent > currentIndent) {
              listResult.push(parseBlock(cleaned[cursor].indent));
            } else {
              listResult.push(null);
            }
          } else if (itemText.includes(':')) {
            // Item starts with a key-value: e.g. "- name: Run tests"
            const firstColon = itemText.indexOf(':');
            const k = itemText.slice(0, firstColon).trim();
            const v = itemText.slice(firstColon + 1).trim();

            const obj: Record<string, any> = {};
            if (v === '' || v === '|' || v === '>') {
              if (v === '|' || v === '>') {
                obj[k] = parseMultiline(currentIndent + 2);
              } else if (cursor < cleaned.length && cleaned[cursor].indent > currentIndent) {
                obj[k] = parseBlock(cleaned[cursor].indent);
              } else {
                obj[k] = null;
              }
            } else {
              obj[k] = parseScalar(v);
            }

            // Consume remaining sibling keys of this object
            const objIndent = currentIndent + 2;
            while (cursor < cleaned.length && cleaned[cursor].indent >= objIndent && !cleaned[cursor].text.startsWith('-')) {
              const line = cleaned[cursor];
              const colonIdx = line.text.indexOf(':');
              if (colonIdx === -1) {
                cursor++;
                continue;
              }
              const propKey = line.text.slice(0, colonIdx).trim();
              const propVal = line.text.slice(colonIdx + 1).trim();
              cursor++;

              if (propVal === '|' || propVal === '>') {
                obj[propKey] = parseMultiline(line.indent + 2);
              } else if (propVal === '') {
                if (cursor < cleaned.length && cleaned[cursor].indent > line.indent) {
                  obj[propKey] = parseBlock(cleaned[cursor].indent);
                } else {
                  obj[propKey] = {};
                }
              } else {
                obj[propKey] = parseScalar(propVal);
              }
            }
            listResult.push(obj);
          } else {
            listResult.push(parseScalar(itemText));
          }
        }
        return listResult;
      }

      // Map block
      const mapResult: Record<string, any> = {};
      while (cursor < cleaned.length && cleaned[cursor].indent === currentIndent) {
        const line = cleaned[cursor];
        if (line.text.startsWith('-')) break;

        const colonIdx = line.text.indexOf(':');
        if (colonIdx === -1) {
          cursor++;
          continue;
        }

        const key = line.text.slice(0, colonIdx).trim();
        const rawVal = line.text.slice(colonIdx + 1).trim();
        cursor++;

        if (rawVal === '|' || rawVal === '>') {
          mapResult[key] = parseMultiline(currentIndent + 2);
        } else if (rawVal === '') {
          if (cursor < cleaned.length && cleaned[cursor].indent > currentIndent) {
            mapResult[key] = parseBlock(cleaned[cursor].indent);
          } else {
            mapResult[key] = {};
          }
        } else {
          mapResult[key] = parseScalar(rawVal);
        }
      }
      return mapResult;
    }

    function parseMultiline(minIndent: number): string {
      const buffer: string[] = [];
      while (cursor < cleaned.length && cleaned[cursor].indent >= minIndent) {
        buffer.push(cleaned[cursor].text);
        cursor++;
      }
      return buffer.join('\n');
    }

    function parseScalar(val: string): any {
      val = val.trim();
      // Flow array: [a, b, c]
      if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(',').map(s => parseScalar(s.trim()));
      }
      // Flow dict: { a: b, c: d }
      if (val.startsWith('{') && val.endsWith('}')) {
        const inner = val.slice(1, -1).trim();
        if (!inner) return {};
        const dict: Record<string, any> = {};
        const pairs = inner.split(',');
        for (const p of pairs) {
          const [k, v] = p.split(':');
          if (k && v !== undefined) dict[k.trim()] = parseScalar(v.trim());
        }
        return dict;
      }
      // Quoted string
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        return val.slice(1, -1);
      }
      // Booleans
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
      // Numbers
      if (!isNaN(Number(val)) && val !== '') return Number(val);
      return val;
    }

    return parseBlock(0) || {};
  }

  private static findKeyLine(lines: string[], key: string, parentSection?: string): number {
    let inSection = !parentSection;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (parentSection && line.trim().startsWith(`${parentSection}:`)) {
        inSection = true;
        continue;
      }
      if (inSection && line.trim().startsWith(`${key}:`)) {
        return i + 1;
      }
    }
    return 1;
  }

  private static findStepLine(lines: string[], step: any, startLine: number): number {
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (step.name && line.includes(`name:`) && line.includes(step.name)) {
        return i + 1;
      }
      if (step.uses && line.includes(`uses:`) && line.includes(step.uses)) {
        return i + 1;
      }
      if (step.run && line.includes(`run:`)) {
        return i + 1;
      }
    }
    return startLine;
  }
}
