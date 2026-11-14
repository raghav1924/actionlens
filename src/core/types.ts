export type FindingCategory = 'SECURITY' | 'PERFORMANCE' | 'BEST_PRACTICE' | 'RELIABILITY';
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface WorkflowStep {
  index: number;
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
  if?: string;
  continueOnError?: boolean;
  timeoutMinutes?: number;
  line: number;
}

export interface WorkflowJob {
  id: string;
  name?: string;
  runsOn?: string | string[];
  needs?: string[];
  timeoutMinutes?: number;
  concurrency?: {
    group: string;
    cancelInProgress?: boolean;
  };
  permissions?: Record<string, string> | string;
  environment?: string;
  matrix?: {
    [key: string]: any[];
  };
  steps: WorkflowStep[];
  line: number;
}

export interface WorkflowFile {
  filePath: string;
  fileName: string;
  name: string;
  on: Record<string, any> | string[];
  permissions?: Record<string, string> | string;
  concurrency?: {
    group: string;
    cancelInProgress?: boolean;
  };
  jobs: Record<string, WorkflowJob>;
  rawContent: string;
  lines: string[];
}

export interface AuditFinding {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  jobId?: string;
  stepIndex?: number;
  stepName?: string;
  line?: number;
  message: string;
  remediation: string;
  autoFixSnippet?: string;
}

export interface DagNode {
  id: string;
  name: string;
  dependsOn: string[];
  dependents: string[];
  depth: number;
  isCriticalPath: boolean;
}

export interface WorkflowAuditReport {
  filePath: string;
  fileName: string;
  workflowName: string;
  score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  findings: AuditFinding[];
  stats: {
    totalJobs: number;
    totalSteps: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  dag: {
    nodes: DagNode[];
    criticalPath: string[];
    maxParallelJobs: number;
  };
}

