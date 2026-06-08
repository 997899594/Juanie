export interface MigrationFilePreviewSnapshot {
  sourceLabel: string;
  files: string[];
  fileDetails?: MigrationFilePreviewDetail[];
  historyFiles?: string[];
  historyFileDetails?: MigrationFilePreviewDetail[];
  executionPlan?: MigrationFileExecutionPlan | null;
  total: number;
  declaredTotal: number;
  executedTotal: number;
  truncated: boolean;
  warning?: string | null;
}

export interface MigrationFilePreviewDetail {
  path: string;
  content: string;
  truncated: boolean;
  language: 'sql' | 'javascript' | 'typescript' | 'text';
}

export interface MigrationFileExecutionPlan {
  path: string;
  content: string;
  language: 'sql';
}
