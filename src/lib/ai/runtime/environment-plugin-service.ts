import { and, eq } from 'drizzle-orm';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import { db } from '@/lib/db';
import { environments, teamMembers } from '@/lib/db/schema';

type EnvironmentAIPluginStatus = 'ok' | 'unauthorized' | 'forbidden' | 'not_found';

export interface EnvironmentAIPluginResponse<TOutput = unknown> {
  status: EnvironmentAIPluginStatus;
  payload?: Awaited<ReturnType<typeof resolveAIPluginSnapshot<TOutput>>>;
}

export async function resolveEnvironmentAIPlugin<TOutput = unknown>(input: {
  userId: string;
  projectId: string;
  environmentId: string;
  pluginId: string;
  forceRefresh?: boolean;
}): Promise<EnvironmentAIPluginResponse<TOutput>> {
  const environment = await db.query.environments.findFirst({
    where: and(
      eq(environments.id, input.environmentId),
      eq(environments.projectId, input.projectId)
    ),
    columns: {
      id: true,
      projectId: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!environment) {
    return { status: 'not_found' };
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, environment.project.teamId),
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
      teamId: environment.project.teamId,
      projectId: environment.projectId,
      environmentId: environment.id,
      actorUserId: input.userId,
    },
    forceRefresh: input.forceRefresh,
  });

  return {
    status: 'ok',
    payload,
  };
}
