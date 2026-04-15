import { isPreviewEnvironment } from '@/lib/environments/model';
import { getPreviousReleaseByScope, getReleaseById } from '@/lib/releases';
import { getReleaseOperationalContext } from '@/lib/releases/runtime-context';
import { decorateReleaseDetail } from '@/lib/releases/view';

export async function loadAIReleaseContext(input: { projectId: string; releaseId: string }) {
  const release = await getReleaseById(input.releaseId);
  if (!release || release.projectId !== input.projectId) {
    throw new Error('Release not found');
  }

  const [previousRelease, runtimeContext] = await Promise.all([
    getPreviousReleaseByScope({
      projectId: input.projectId,
      environmentId: release.environmentId,
      createdAt: release.createdAt,
    }),
    getReleaseOperationalContext({
      projectId: release.projectId,
      teamId: release.project.teamId,
      environmentId: release.environmentId,
      environmentName: release.environment.name,
      environmentIsPreview: isPreviewEnvironment(release.environment),
      namespace: release.environment.namespace,
      deploymentStrategy: release.environment.deploymentStrategy,
      releaseWindow: {
        startedAt: release.createdAt,
        finishedAt: release.updatedAt,
      },
    }),
  ]);

  const decoratedRelease = decorateReleaseDetail(
    {
      ...release,
      infrastructureDiagnostics: runtimeContext.infrastructureDiagnostics,
      governanceEvents: runtimeContext.governanceEvents,
    },
    previousRelease ?? null
  );

  return {
    release,
    previousRelease,
    runtimeContext,
    decoratedRelease,
  };
}
