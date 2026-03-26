import type {
  databases,
  deployments,
  environments,
  migrationRunItems,
  migrationRuns,
  migrationSpecifications,
  services,
} from '@/lib/db/schema';
import type {
  EnvironmentPolicySnapshot,
  MigrationPolicyDecision,
  ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import type { PlatformSignalSnapshot } from '@/lib/signals/platform';

export type MigrationSpecificationRecord = typeof migrationSpecifications.$inferSelect;
export type MigrationRunRecord = typeof migrationRuns.$inferSelect;
export type MigrationRunItemRecord = typeof migrationRunItems.$inferSelect;
export type DatabaseRecord = typeof databases.$inferSelect;
export type ServiceRecord = typeof services.$inferSelect;
export type EnvironmentRecord = typeof environments.$inferSelect;
export type DeploymentRecord = typeof deployments.$inferSelect;

export interface MigrationResolutionInfo {
  strategy: string;
  selector: {
    bindingName: string | null;
    bindingRole: DatabaseRecord['role'] | null;
    bindingDatabaseType: DatabaseRecord['type'] | null;
  };
}

export interface ResolvedMigrationSpec {
  specification: MigrationSpecificationRecord;
  database: DatabaseRecord;
  service: ServiceRecord;
  environment: EnvironmentRecord;
  resolution: MigrationResolutionInfo;
}

export interface ExecuteMigrationRunOptions {
  imageUrl?: string | null;
  allowApprovalBypass?: boolean;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}

export interface MigrationExecutionPlan {
  confirmationValue: string;
  canRun: boolean;
  blockingReason: string | null;
  filePreviewError: string | null;
  warnings: string[];
  platformSignals: PlatformSignalSnapshot;
  environmentPolicy: EnvironmentPolicySnapshot;
  migrationPolicy: MigrationPolicyDecision;
  releasePolicy: ReleasePolicySnapshot;
  runnerType: 'k8s_job' | 'worker';
  imageUrl: string | null;
  database: {
    id: string;
    name: string;
    type: DatabaseRecord['type'];
    status: string | null;
  };
  service: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
    branch: string | null;
    isProduction: boolean;
  };
  specification: {
    id: string;
    tool: MigrationSpecificationRecord['tool'];
    phase: MigrationSpecificationRecord['phase'];
    workingDirectory: string;
    migrationPath: string | null;
    command: string;
    compatibility: MigrationSpecificationRecord['compatibility'];
    approvalPolicy: MigrationSpecificationRecord['approvalPolicy'];
    lockStrategy: MigrationSpecificationRecord['lockStrategy'];
    autoRun: boolean;
  };
  resolution: MigrationResolutionInfo;
  envVars: string[];
  sqlFiles: Array<{
    name: string;
  }>;
}
