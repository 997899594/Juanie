export type DeploymentDiagnosticWorkloadKind = 'deployment' | 'argo_rollout' | 'unknown';

export interface DeploymentDiagnosticCondition {
  type: string;
  status: string;
  reason: string | null;
  message: string | null;
}

export interface DeploymentDiagnosticWorkloadSnapshot {
  kind: DeploymentDiagnosticWorkloadKind;
  name: string | null;
  namespace: string | null;
  summary: string;
  selector: string | null;
  desiredReplicas: number | null;
  updatedReplicas: number | null;
  readyReplicas: number | null;
  availableReplicas: number | null;
  generation: number | string | null;
  observedGeneration: number | string | null;
  phase: string | null;
  image: string | null;
  stableSelector?: string | null;
  previewSelector?: string | null;
  conditions: DeploymentDiagnosticCondition[];
}

export interface DeploymentDiagnosticContainerSnapshot {
  name: string;
  image: string | null;
  ready: boolean | null;
  restartCount: number | null;
  state: string | null;
  reason: string | null;
  message: string | null;
  exitCode: number | null;
  lastReason: string | null;
  lastExitCode: number | null;
}

export interface DeploymentDiagnosticPodSnapshot {
  name: string;
  phase: string | null;
  reason: string | null;
  message: string | null;
  nodeName: string | null;
  podIp: string | null;
  createdAt: string | null;
  labels: Record<string, string>;
  summary: string;
  containers: DeploymentDiagnosticContainerSnapshot[];
}

export interface DeploymentDiagnosticEventSnapshot {
  type: string | null;
  reason: string | null;
  message: string | null;
  involvedObjectKind: string | null;
  involvedObjectName: string | null;
  timestamp: string | null;
}

export interface DeploymentDiagnosticLogTailSnapshot {
  podName: string;
  containerName: string;
  previous: boolean;
  text: string;
}

export interface DeploymentDiagnosticSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  reason: string;
  errorMessage: string;
  namespace: string | null;
  workload: DeploymentDiagnosticWorkloadSnapshot;
  pods: DeploymentDiagnosticPodSnapshot[];
  events: DeploymentDiagnosticEventSnapshot[];
  logTails: DeploymentDiagnosticLogTailSnapshot[];
}
