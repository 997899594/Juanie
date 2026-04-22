import { NextResponse } from 'next/server';
import { handleEnvironmentAnalysisRequest } from '@/lib/ai/runtime/environment-analysis-api';
import { getAIPluginByIdForTeam } from '@/lib/ai/runtime/plugin-registry';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string; pluginId: string }> }
) {
  try {
    const { id: projectId, envId, pluginId } = await params;
    const session = await requireSession();
    const access = await getProjectAccessOrThrow(projectId, session.user.id);
    const plugin = await getAIPluginByIdForTeam(access.project.teamId, pluginId);

    if (!plugin || plugin.manifest.kind === 'core' || plugin.manifest.scope !== 'environment') {
      return NextResponse.json({ error: '动态插件不存在' }, { status: 404 });
    }

    return handleEnvironmentAnalysisRequest<DynamicPluginOutput>({
      userId: session.user.id,
      projectId,
      environmentId: envId,
      pluginId,
      forceRefresh: false,
      notFoundMessage: '环境不存在',
      forbiddenMessage: '没有权限访问这个环境',
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string; pluginId: string }> }
) {
  try {
    const { id: projectId, envId, pluginId } = await params;
    const session = await requireSession();
    const access = await getProjectAccessOrThrow(projectId, session.user.id);
    const plugin = await getAIPluginByIdForTeam(access.project.teamId, pluginId);

    if (!plugin || plugin.manifest.kind === 'core' || plugin.manifest.scope !== 'environment') {
      return NextResponse.json({ error: '动态插件不存在' }, { status: 404 });
    }

    return handleEnvironmentAnalysisRequest<DynamicPluginOutput>({
      userId: session.user.id,
      projectId,
      environmentId: envId,
      pluginId,
      forceRefresh: true,
      notFoundMessage: '环境不存在',
      forbiddenMessage: '没有权限访问这个环境',
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '动态插件刷新失败' },
      { status: 500 }
    );
  }
}
