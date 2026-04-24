import { handleScopedAIPluginAnalysisRequest } from '@/lib/ai/runtime/plugin-analysis';

export async function handleEnvironmentAnalysisRequest<TOutput>(input: {
  userId: string;
  projectId: string;
  environmentId: string;
  pluginId: string;
  forceRefresh: boolean;
  notFoundMessage: string;
  forbiddenMessage: string;
}) {
  return handleScopedAIPluginAnalysisRequest<TOutput>({
    scope: 'environment',
    userId: input.userId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    pluginId: input.pluginId,
    forceRefresh: input.forceRefresh,
    notFoundMessage: input.notFoundMessage,
    forbiddenMessage: input.forbiddenMessage,
    refreshAuditAction: 'environment.ai_summary_refreshed',
  });
}
