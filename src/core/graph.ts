import { DagNode, WorkflowJob } from './types.js';

export class WorkflowGraph {
  /**
   * Build a topological DAG from workflow jobs.
   */
  public static buildDag(jobs: Record<string, WorkflowJob>): {
    nodes: DagNode[];
    criticalPath: string[];
    maxParallelJobs: number;
    mermaid: string;
    hasCycles: boolean;
  } {
    const jobIds = Object.keys(jobs);
    if (jobIds.length === 0) {
      return {
        nodes: [],
        criticalPath: [],
        maxParallelJobs: 0,
        mermaid: 'flowchart LR\n  empty["No jobs defined"]',
        hasCycles: false,
      };
    }

    const nodeMap: Record<string, DagNode> = {};
    for (const id of jobIds) {
      nodeMap[id] = {
        id,
        name: jobs[id].name || id,
        dependsOn: [...(jobs[id].needs || [])],
        dependents: [],
        depth: 0,
        isCriticalPath: false,
      };
    }

    // Populate dependents
    for (const id of jobIds) {
      for (const dep of nodeMap[id].dependsOn) {
        if (nodeMap[dep]) {
          nodeMap[dep].dependents.push(id);
        }
      }
    }

    // Check for cycles and compute topological depth
    const visited: Record<string, boolean> = {};
    const recStack: Record<string, boolean> = {};
    let hasCycles = false;

    function detectCycle(u: string): boolean {
      visited[u] = true;
      recStack[u] = true;
      for (const v of nodeMap[u]?.dependents || []) {
        if (!visited[v] && detectCycle(v)) return true;
        if (recStack[v]) return true;
      }
      recStack[u] = false;
      return false;
    }

    for (const id of jobIds) {
      if (!visited[id]) {
        if (detectCycle(id)) {
          hasCycles = true;
          break;
        }
      }
    }

    // Compute depths (longest distance from any root)
    if (!hasCycles) {
      const depthMemo: Record<string, number> = {};
      function getDepth(id: string): number {
        if (depthMemo[id] !== undefined) return depthMemo[id];
        const deps = nodeMap[id].dependsOn.filter(d => nodeMap[d]);
        if (deps.length === 0) {
          depthMemo[id] = 0;
          return 0;
        }
        let maxDep = 0;
        for (const d of deps) {
          maxDep = Math.max(maxDep, getDepth(d) + 1);
        }
        depthMemo[id] = maxDep;
        return maxDep;
      }

      for (const id of jobIds) {
        nodeMap[id].depth = getDepth(id);
      }
    }

    // Calculate maximum parallel jobs (max nodes sharing the same depth)
    const depthCounts: Record<number, number> = {};
    for (const id of jobIds) {
      const d = nodeMap[id].depth;
      depthCounts[d] = (depthCounts[d] || 0) + 1;
    }
    const maxParallelJobs = Object.values(depthCounts).length > 0 ? Math.max(...Object.values(depthCounts)) : 1;

    // Find critical path (path with deepest total depth)
    const criticalPath: string[] = [];
    if (!hasCycles && jobIds.length > 0) {
      let maxDepthNode = jobIds[0];
      for (const id of jobIds) {
        if (nodeMap[id].depth > nodeMap[maxDepthNode].depth) {
          maxDepthNode = id;
        }
      }

      let curr: string | undefined = maxDepthNode;
      while (curr) {
        criticalPath.unshift(curr);
        nodeMap[curr].isCriticalPath = true;
        const deps: string[] = nodeMap[curr].dependsOn.filter(d => Boolean(nodeMap[d]));
        if (deps.length === 0) break;
        // choose parent with max depth
        let maxParent: string = deps[0];
        for (const p of deps) {
          if (nodeMap[p].depth > nodeMap[maxParent].depth) {
            maxParent = p;
          }
        }
        curr = maxParent;
      }
    }

    // Synthesize Mermaid flowchart
    const mermaidLines: string[] = ['flowchart LR'];
    for (const id of jobIds) {
      const node = nodeMap[id];
      const safeLabel = node.name.replace(/"/g, "'");
      if (node.isCriticalPath) {
        mermaidLines.push(`  ${id}["⚡ ${safeLabel}"]:::critical`);
      } else {
        mermaidLines.push(`  ${id}["${safeLabel}"]`);
      }
    }

    for (const id of jobIds) {
      for (const dep of nodeMap[id].dependsOn) {
        if (nodeMap[dep]) {
          mermaidLines.push(`  ${dep} --> ${id}`);
        }
      }
    }

    mermaidLines.push('  classDef critical fill:#ef444422,stroke:#ef4444,stroke-width:2px,color:#f87171;');

    return {
      nodes: Object.values(nodeMap),
      criticalPath,
      maxParallelJobs,
      mermaid: mermaidLines.join('\n'),
      hasCycles,
    };
  }
}
