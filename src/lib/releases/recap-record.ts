export interface ReleaseSummarySnapshot {
  changed: string;
  risk: string;
  result: string;
  governance: string | null;
  nextAction: string | null;
}

export interface ReleaseBlockingReason {
  label: string;
  summary: string;
  nextActionLabel: string | null;
}

export interface ReleaseGovernanceEvent {
  key: string;
  code:
    | 'preview_deleted'
    | 'preview_cleanup_completed'
    | 'cleanup_terminating_pods'
    | 'restart_deployments';
  title: string;
  description: string;
  at: Date | string | null;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface ReleaseRecapRecord {
  version: 1;
  generatedAt: string;
  statusLabel: string;
  headline: string;
  primarySummary: string;
  narrative: ReleaseSummarySnapshot;
  blockingReason: ReleaseBlockingReason | null;
}
