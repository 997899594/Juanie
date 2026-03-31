import { and, eq } from 'drizzle-orm';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import { db } from '@/lib/db';
import { releases, teamMembers } from '@/lib/db/schema';

type ReleaseAIPluginStatus = 'ok' | 'unauthorized' | 'forbidden' | 'not_found';

export interface ReleaseAIPluginResponse<TOutput = unknown> {
  status: ReleaseAIPluginStatus;
  payload?: Awaited<ReturnType<typeof resolveAIPluginSnapshot<TOutput>>>;
}

export async function resolveReleaseAIPlugin<TOutput = unknown>(input: {
  userId: string;
  projectId: string;
  releaseId: string;
  pluginId: string;
  forceRefresh?: boolean;
}): Promise<ReleaseAIPluginResponse<TOutput>> {
  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, input.releaseId), eq(releases.projectId, input.projectId)),
    columns: {
      id: true,
      projectId: true,
      environmentId: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!release) {
    return { status: 'not_found' };
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, release.project.teamId),
      eq(teamMembers.userId, input.userId)
    ),
    columns: {
      id: true,
    },
  });

  if (!member) {
    return { status: 'forbidden' };
  }

  const payload = await resolveAIPluginSnapshot<TOutput>({
    pluginId: input.pluginId,
    context: {
      teamId: release.project.teamId,
      projectId: release.projectId,
      environmentId: release.environmentId,
      releaseId: release.id,
      actorUserId: input.userId,
    },
    forceRefresh: input.forceRefresh,
  });

  return {
    status: 'ok',
    payload,
  };
}
