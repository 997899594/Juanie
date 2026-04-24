import { type DynamicPluginOutput, handleDynamicPluginRoute } from '@/lib/ai/runtime/plugin-route';
import { handleReleaseAnalysisRequest } from '@/lib/ai/runtime/release-analysis-api';
import { getProjectReleaseAccessOrThrow, requireSession } from '@/lib/api/access';

async function handleRequest(
  params: Promise<{ id: string; releaseId: string; pluginId: string }>,
  forceRefresh: boolean
) {
  const { id: projectId, releaseId, pluginId } = await params;
  const session = await requireSession();
  const { project } = await getProjectReleaseAccessOrThrow(projectId, releaseId, session.user.id);

  return handleDynamicPluginRoute({
    pluginId,
    teamId: project.teamId,
    scope: 'release',
    forceRefresh,
    fallbackMessage: forceRefresh ? '动态插件刷新失败' : '动态插件加载失败',
    run: () =>
      handleReleaseAnalysisRequest<DynamicPluginOutput>({
        userId: session.user.id,
        projectId,
        releaseId,
        pluginId,
        forceRefresh,
        notFoundMessage: '发布不存在',
        forbiddenMessage: '没有权限访问该发布',
      }),
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string; pluginId: string }> }
) {
  return handleRequest(params, false);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string; pluginId: string }> }
) {
  return handleRequest(params, true);
}
