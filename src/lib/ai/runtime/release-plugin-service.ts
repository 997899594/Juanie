import {
  resolveScopedAIPluginSnapshot,
  type ScopedAIPluginResponse,
} from '@/lib/ai/runtime/plugin-analysis';

type ReleaseAIPluginStatus = 'ok' | 'unauthorized' | 'forbidden' | 'not_found';

export interface ReleaseAIPluginResponse<TOutput = unknown> {
  status: ReleaseAIPluginStatus;
  payload?: ScopedAIPluginResponse<TOutput>['payload'];
}

export async function resolveReleaseAIPlugin<TOutput = unknown>(input: {
  userId: string;
  projectId: string;
  releaseId: string;
  pluginId: string;
  forceRefresh?: boolean;
}): Promise<ReleaseAIPluginResponse<TOutput>> {
  const result = await resolveScopedAIPluginSnapshot<TOutput>({
    scope: 'release',
    userId: input.userId,
    projectId: input.projectId,
    releaseId: input.releaseId,
    pluginId: input.pluginId,
    forceRefresh: input.forceRefresh,
  });

  return {
    status: result.status,
    payload: result.payload,
  };
}
