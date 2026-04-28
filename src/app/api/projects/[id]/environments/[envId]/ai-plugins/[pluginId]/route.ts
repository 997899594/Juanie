import { handleEnvironmentAnalysisRequest } from '@/lib/ai/runtime/environment-analysis-api';
import { type DynamicPluginOutput, handleDynamicPluginRoute } from '@/lib/ai/runtime/plugin-route';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';

async function handleRequest(
  params: Promise<{ id: string; envId: string; pluginId: string }>,
  forceRefresh: boolean,
  allowLiveExecution: boolean
) {
  const { id: projectId, envId, pluginId } = await params;
  const session = await requireSession();
  const { project } = await getProjectEnvironmentAccessOrThrow(projectId, envId, session.user.id);

  return handleDynamicPluginRoute({
    pluginId,
    teamId: project.teamId,
    scope: 'environment',
    forceRefresh,
    fallbackMessage: forceRefresh ? '动态插件刷新失败' : '动态插件加载失败',
    run: () =>
      handleEnvironmentAnalysisRequest<DynamicPluginOutput>({
        userId: session.user.id,
        projectId,
        environmentId: envId,
        pluginId,
        forceRefresh,
        allowLiveExecution,
        notFoundMessage: '环境不存在',
        forbiddenMessage: '没有权限访问这个环境',
      }),
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string; pluginId: string }> }
) {
  return handleRequest(params, false, false);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string; pluginId: string }> }
) {
  return handleRequest(params, true, true);
}
