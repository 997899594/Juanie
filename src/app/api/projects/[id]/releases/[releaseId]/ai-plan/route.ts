import { handleReleaseAnalysisRequest } from '@/lib/ai/runtime/release-analysis-api';
import { type ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { requireSession } from '@/lib/api/access';

async function handleRequest(
  params: Promise<{ id: string; releaseId: string }>,
  forceRefresh: boolean,
  allowLiveExecution: boolean
) {
  const { id: projectId, releaseId } = await params;
  const session = await requireSession();

  return handleReleaseAnalysisRequest<ReleasePlan>({
    userId: session.user.id,
    projectId,
    releaseId,
    pluginId: 'release-intelligence',
    forceRefresh,
    allowLiveExecution,
    notFoundMessage: '发布不存在',
    forbiddenMessage: '没有权限访问该发布',
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  return handleRequest(params, false, false);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  return handleRequest(params, true, true);
}
