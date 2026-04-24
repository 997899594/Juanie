import {
  resolveScopedAIPluginSnapshot,
  type ScopedAIPluginResponse,
} from '@/lib/ai/runtime/plugin-analysis';

type EnvironmentAIPluginStatus = 'ok' | 'unauthorized' | 'forbidden' | 'not_found';

export interface EnvironmentAIPluginResponse<TOutput = unknown> {
  status: EnvironmentAIPluginStatus;
  payload?: ScopedAIPluginResponse<TOutput>['payload'];
}

export async function resolveEnvironmentAIPlugin<TOutput = unknown>(input: {
  userId: string;
  projectId: string;
  environmentId: string;
  pluginId: string;
  forceRefresh?: boolean;
}): Promise<EnvironmentAIPluginResponse<TOutput>> {
  const result = await resolveScopedAIPluginSnapshot<TOutput>({
    scope: 'environment',
    userId: input.userId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    pluginId: input.pluginId,
    forceRefresh: input.forceRefresh,
  });

  return {
    status: result.status,
    payload: result.payload,
  };
}
