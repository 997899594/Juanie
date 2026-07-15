import type { MigrationPhase, MigrationReleaseStage } from '@/lib/db/schema';

export const atlasReleaseGraphMigrationStages = [
  'expand',
  'backfill',
  'verify',
  'contract',
] as const satisfies readonly MigrationReleaseStage[];

export type AtlasReleaseGraphMigrationStage = (typeof atlasReleaseGraphMigrationStages)[number];

export interface AtlasReleaseGraphConfig {
  baselineVersion?: string;
  expand: { targetVersion: string };
  backfill: { targetVersion: string };
  verify: { targetVersion: string };
  cutover: 'deployment';
  contract: { targetVersion: string };
}

export interface ResolvedReleaseGraphStage {
  releaseStage: AtlasReleaseGraphMigrationStage;
  stageOrder: number;
  targetVersion: string;
  baselineVersion: string | null;
  phase: Exclude<MigrationPhase, 'manual'>;
}

const stageOrder = new Map<MigrationReleaseStage, number>([
  ['standard', 0],
  ['expand', 10],
  ['backfill', 20],
  ['verify', 30],
  ['contract', 50],
]);

export function getMigrationReleaseStageOrder(stage: MigrationReleaseStage): number {
  return stageOrder.get(stage) ?? Number.MAX_SAFE_INTEGER;
}

export function expandAtlasReleaseGraph(
  graph: AtlasReleaseGraphConfig
): ResolvedReleaseGraphStage[] {
  return atlasReleaseGraphMigrationStages.map((releaseStage) => ({
    releaseStage,
    stageOrder: getMigrationReleaseStageOrder(releaseStage),
    targetVersion: graph[releaseStage].targetVersion,
    baselineVersion: graph.baselineVersion ?? null,
    phase: releaseStage === 'contract' ? 'postDeploy' : 'preDeploy',
  }));
}

export function getMigrationReleaseStageLabel(stage?: string | null): string {
  switch (stage) {
    case 'expand':
      return 'Expand';
    case 'backfill':
      return 'Backfill';
    case 'verify':
      return 'Verify';
    case 'contract':
      return 'Contract';
    default:
      return '标准迁移';
  }
}
