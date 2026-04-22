import { NextResponse } from 'next/server';
import { getAIPluginByIdForTeam } from '@/lib/ai/runtime/plugin-registry';
import { handleReleaseAnalysisRequest } from '@/lib/ai/runtime/release-analysis-api';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';

async function handleRequest(
  params: Promise<{ id: string; releaseId: string; pluginId: string }>,
  forceRefresh: boolean
) {
  try {
    const { id: projectId, releaseId, pluginId } = await params;
    const session = await requireSession();
    const access = await getProjectAccessOrThrow(projectId, session.user.id);
    const plugin = await getAIPluginByIdForTeam(access.project.teamId, pluginId);

    if (!plugin || plugin.manifest.kind === 'core' || plugin.manifest.scope !== 'release') {
      return NextResponse.json({ error: '动态插件不存在' }, { status: 404 });
    }

    return handleReleaseAnalysisRequest<DynamicPluginOutput>({
      userId: session.user.id,
      projectId,
      releaseId,
      pluginId,
      forceRefresh,
      notFoundMessage: '发布不存在',
      forbiddenMessage: '没有权限访问该发布',
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '动态插件加载失败' },
      { status: 500 }
    );
  }
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
