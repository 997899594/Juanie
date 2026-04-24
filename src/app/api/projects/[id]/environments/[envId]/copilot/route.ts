import { handleCopilotRoute } from '@/lib/ai/copilot/route';
import { generateEnvironmentCopilotStream } from '@/lib/ai/copilot/service';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  return handleCopilotRoute({
    request,
    loadScope: async () => {
      const session = await requireSession();
      const { id: projectId, envId } = await params;
      const { project, environment } = await getProjectEnvironmentAccessOrThrow(
        projectId,
        envId,
        session.user.id
      );

      return {
        teamId: project.teamId,
        userId: session.user.id,
        projectId: project.id,
        resourceId: environment.id,
        resourceType: 'environment' as const,
        action: 'environment.copilot_asked' as const,
        environmentId: environment.id,
      };
    },
    generateReply: (scope, messages) =>
      generateEnvironmentCopilotStream({
        teamId: scope.teamId,
        projectId: scope.projectId,
        environmentId: scope.resourceId,
        actorUserId: scope.userId,
        messages,
      }),
  });
}
