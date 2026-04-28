import { NextResponse } from 'next/server';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import {
  getProjectEnvironmentAccessOrThrow,
  getProjectReleaseAccessOrThrow,
} from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';

type AIPluginAccessStatus = 'ok' | 'forbidden' | 'not_found';

export interface ScopedAIPluginResponse<TOutput = unknown> {
  status: AIPluginAccessStatus;
  payload?: Awaited<ReturnType<typeof resolveAIPluginSnapshot<TOutput>>>;
  teamId?: string;
  environmentId?: string;
}

export async function resolveScopedAIPluginSnapshot<TOutput>(input: {
  scope: 'environment' | 'release';
  userId: string;
  projectId: string;
  environmentId?: string;
  releaseId?: string;
  pluginId: string;
  forceRefresh?: boolean;
  allowLiveExecution?: boolean;
}): Promise<ScopedAIPluginResponse<TOutput>> {
  try {
    if (input.scope === 'environment') {
      const access = await getProjectEnvironmentAccessOrThrow(
        input.projectId,
        input.environmentId ?? '',
        input.userId
      );
      const payload = await resolveAIPluginSnapshot<TOutput>({
        pluginId: input.pluginId,
        context: {
          teamId: access.project.teamId,
          projectId: access.project.id,
          environmentId: access.environment.id,
          actorUserId: input.userId,
        },
        forceRefresh: input.forceRefresh,
        allowLiveExecution: input.allowLiveExecution,
      });

      return {
        status: 'ok',
        payload,
        teamId: access.project.teamId,
        environmentId: access.environment.id,
      };
    }

    const access = await getProjectReleaseAccessOrThrow(
      input.projectId,
      input.releaseId ?? '',
      input.userId
    );
    const payload = await resolveAIPluginSnapshot<TOutput>({
      pluginId: input.pluginId,
      context: {
        teamId: access.project.teamId,
        projectId: access.project.id,
        environmentId: access.release.environmentId,
        releaseId: access.release.id,
        actorUserId: input.userId,
      },
      forceRefresh: input.forceRefresh,
      allowLiveExecution: input.allowLiveExecution,
    });

    return {
      status: 'ok',
      payload,
      teamId: access.project.teamId,
      environmentId: access.release.environmentId,
    };
  } catch (error) {
    if (isAccessError(error)) {
      return {
        status: error.code === 'forbidden' ? 'forbidden' : 'not_found',
      };
    }

    throw error;
  }
}

export async function handleScopedAIPluginAnalysisRequest<TOutput>(input: {
  scope: 'environment' | 'release';
  userId: string;
  projectId: string;
  environmentId?: string;
  releaseId?: string;
  pluginId: string;
  forceRefresh: boolean;
  allowLiveExecution?: boolean;
  notFoundMessage: string;
  forbiddenMessage: string;
  refreshAuditAction: 'environment.ai_summary_refreshed' | 'release.ai_analysis_refreshed';
}): Promise<NextResponse> {
  const result = await resolveScopedAIPluginSnapshot<TOutput>(input);

  if (result.status === 'not_found') {
    return NextResponse.json({ error: input.notFoundMessage }, { status: 404 });
  }

  if (result.status === 'forbidden') {
    return NextResponse.json({ error: input.forbiddenMessage }, { status: 403 });
  }

  if (input.forceRefresh && result.teamId) {
    await createAuditLog({
      teamId: result.teamId,
      userId: input.userId,
      action: input.refreshAuditAction,
      resourceType: input.scope,
      resourceId: input.scope === 'environment' ? input.environmentId : input.releaseId,
      metadata: {
        pluginId: input.pluginId,
        projectId: input.projectId,
        environmentId: result.environmentId,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json(result.payload);
}
