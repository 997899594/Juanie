import type { MigrationSpecificationSnapshot } from '@/lib/db/schema';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview-types';

export interface ReleaseMigrationPlanStageSnapshot {
  stageKey: string;
  specificationId: string;
  serviceId: string;
  serviceName: string;
  databaseId: string;
  databaseName: string;
  databaseType: string;
  phase: 'preDeploy' | 'postDeploy';
  specification: MigrationSpecificationSnapshot;
  filePreview: MigrationFilePreviewSnapshot;
}

export interface ReleaseMigrationPlanSnapshot {
  version: 1;
  releaseId: string;
  projectId: string;
  environmentId: string;
  sourceRepository: string;
  sourceRef: string;
  sourceCommitSha: string;
  stages: ReleaseMigrationPlanStageSnapshot[];
}
