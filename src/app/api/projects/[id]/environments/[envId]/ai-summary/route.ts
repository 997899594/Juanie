import { handleEnvironmentAnalysisRequest } from '@/lib/ai/runtime/environment-analysis-api';
import { type EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';
import { requireSession } from '@/lib/api/access';

async function handleRequest(
  params: Promise<{ id: string; envId: string }>,
  forceRefresh: boolean
) {
  const { id: projectId, envId } = await params;
  const session = await requireSession();

  return handleEnvironmentAnalysisRequest<EnvironmentSummary>({
    userId: session.user.id,
    projectId,
    environmentId: envId,
    pluginId: 'environment-summary',
    forceRefresh,
    notFoundMessage: '环境不存在',
    forbiddenMessage: '没有权限访问该环境',
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  return handleRequest(params, false);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  return handleRequest(params, true);
}
