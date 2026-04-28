import { handleScopedAIPluginAnalysisRequest } from '@/lib/ai/runtime/plugin-analysis';

export async function handleReleaseAnalysisRequest<TOutput>(input: {
  userId: string;
  projectId: string;
  releaseId: string;
  pluginId: string;
  forceRefresh: boolean;
  allowLiveExecution?: boolean;
  notFoundMessage: string;
  forbiddenMessage: string;
}) {
  return handleScopedAIPluginAnalysisRequest<TOutput>({
    scope: 'release',
    userId: input.userId,
    projectId: input.projectId,
    releaseId: input.releaseId,
    pluginId: input.pluginId,
    forceRefresh: input.forceRefresh,
    allowLiveExecution: input.allowLiveExecution,
    notFoundMessage: input.notFoundMessage,
    forbiddenMessage: input.forbiddenMessage,
    refreshAuditAction: 'release.ai_analysis_refreshed',
  });
}
