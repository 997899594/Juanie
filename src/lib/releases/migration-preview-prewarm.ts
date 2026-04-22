import { resolveMigrationSpecifications } from '@/lib/migrations';
import { buildMigrationFilePreviewByRunId } from '@/lib/migrations/file-preview';

interface PrewarmReleaseMigrationPreviewInput {
  projectId: string;
  environmentId: string;
  sourceRef: string;
  sourceCommitSha?: string | null;
  serviceIds: string[];
}

export async function prewarmReleaseMigrationPreviewCache(
  input: PrewarmReleaseMigrationPreviewInput
): Promise<void> {
  if (input.serviceIds.length === 0) {
    return;
  }

  const phases: Array<'preDeploy' | 'postDeploy'> = ['preDeploy', 'postDeploy'];
  const runs = [];

  for (const phase of phases) {
    const specs = await resolveMigrationSpecifications(
      input.projectId,
      input.environmentId,
      phase,
      {
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha ?? null,
        serviceIds: input.serviceIds,
      }
    );

    for (const spec of specs) {
      runs.push({
        id: `warm:${phase}:${spec.specification.id}`,
        projectId: input.projectId,
        specification: {
          tool: spec.specification.tool,
          migrationPath: spec.specification.migrationPath,
          sourceConfigPath: spec.specification.sourceConfigPath,
        },
        database: {
          id: spec.database.id,
          type: spec.database.type,
          connectionString: spec.database.connectionString,
        },
        release: {
          sourceRef: input.sourceRef,
          sourceCommitSha: input.sourceCommitSha ?? null,
        },
        environment: {
          branch: spec.environment.branch ?? null,
        },
      });
    }
  }

  if (runs.length === 0) {
    return;
  }

  await buildMigrationFilePreviewByRunId(runs, {
    forceRefresh: true,
  });
}
