import type { EnvironmentKind, PromotionFlowStrategy } from '@/lib/db/schema';
import type {
  EnvironmentPolicySnapshot,
  MigrationPolicySignalSnapshot,
  ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import type { ReleaseIssueSnapshot } from '@/lib/releases/intelligence';
import type { ReleaseSchemaGateSnapshot } from '@/lib/schema-safety';
import type { PlatformSignalSnapshot } from '@/lib/signals/platform';

export interface PlanningServiceLike {
  id: string;
  name: string;
  image: string;
  digest?: string | null;
}

export interface PlanningMigrationSpecLike {
  specification: {
    phase: 'preDeploy' | 'postDeploy' | 'manual';
    executionMode: 'automatic' | 'manual_platform' | 'external';
    compatibility?: string | null;
    approvalPolicy?: string | null;
  };
  database?: {
    id?: string | null;
    type?: string | null;
  } | null;
  environment: {
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
}

export interface PlanningEnvironmentLike {
  id?: string;
  kind?: EnvironmentKind | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  deliveryMode?: 'direct' | 'promote_only' | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
}

export interface ReleasePlanningSnapshot {
  canCreate: boolean;
  blockingReason: string | null;
  services: PlanningServiceLike[];
  environmentPolicy: EnvironmentPolicySnapshot;
  releasePolicy: ReleasePolicySnapshot;
  issue: ReleaseIssueSnapshot | null;
  platformSignals: PlatformSignalSnapshot;
  migration: {
    preDeployCount: number;
    postDeployCount: number;
    automaticCount: number;
    manualPlatformCount: number;
    externalCount: number;
    warnings: string[];
    signals: MigrationPolicySignalSnapshot[];
    primarySignal: MigrationPolicySignalSnapshot | null;
    requiresApproval: boolean;
    requiresExternalCompletion: boolean;
  };
  schema: {
    checkedCount: number;
    blockingCount: number;
    states: ReleaseSchemaGateSnapshot['states'];
    summary: string | null;
    nextActionLabel: string | null;
    refresh: ReleaseSchemaGateSnapshot['refresh'];
  };
  environmentInheritance: string | null;
  environmentDatabaseStrategy: string | null;
  summary: string | null;
}

export interface PromotionPlanSnapshot {
  flowId: string | null;
  strategy: PromotionFlowStrategy | null;
  requiresApproval: boolean;
  isAlreadyPromoted: boolean;
  sourceRelease: {
    id: string;
    summary: string | null;
    sourceCommitSha: string | null;
  } | null;
  sourceEnvironment: {
    id: string;
    name: string;
    isProduction: boolean;
  } | null;
  targetEnvironment: {
    id: string;
    name: string;
    isProduction: boolean;
  } | null;
  plan: ReleasePlanningSnapshot;
}

export interface EnvironmentRollbackCandidate {
  id: string;
  sourceRef: string;
  sourceCommitSha: string | null;
  configCommitSha: string | null;
  summary: string | null;
  createdAt: Date;
  artifacts: Array<{
    service: {
      id: string;
      name: string;
    };
    imageUrl: string;
    imageDigest: string | null;
  }>;
}

export interface PromotionPlanningOptions {
  includeLiveChecks?: boolean;
  requestSchemaRefresh?: boolean;
}
