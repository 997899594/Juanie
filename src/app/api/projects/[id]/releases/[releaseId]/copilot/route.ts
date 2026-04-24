import { handleCopilotRoute } from '@/lib/ai/copilot/route';
import { generateReleaseCopilotStream } from '@/lib/ai/copilot/service';
import { getProjectReleaseAccessOrThrow, requireSession } from '@/lib/api/access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  return handleCopilotRoute({
    request,
    loadScope: async () => {
      const session = await requireSession();
      const { id: projectId, releaseId } = await params;
      const { project, release } = await getProjectReleaseAccessOrThrow(
        projectId,
        releaseId,
        session.user.id
      );

      return {
        teamId: project.teamId,
        userId: session.user.id,
        projectId: project.id,
        resourceId: release.id,
        resourceType: 'release' as const,
        action: 'release.copilot_asked' as const,
        environmentId: release.environmentId,
      };
    },
    generateReply: (scope, messages) =>
      generateReleaseCopilotStream({
        teamId: scope.teamId,
        projectId: scope.projectId,
        releaseId: scope.resourceId,
        actorUserId: scope.userId,
        messages,
      }),
  });
}
