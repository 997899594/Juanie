import { handleReleaseAnalysisRequest } from '@/lib/ai/runtime/release-analysis-api';
import { type IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import { requireSession } from '@/lib/api/access';

async function handleRequest(
  params: Promise<{ id: string; releaseId: string }>,
  forceRefresh: boolean
) {
  const { id: projectId, releaseId } = await params;
  const session = await requireSession();

  return handleReleaseAnalysisRequest<IncidentAnalysis>({
    userId: session.user.id,
    projectId,
    releaseId,
    pluginId: 'incident-intelligence',
    forceRefresh,
    notFoundMessage: '发布不存在',
    forbiddenMessage: '没有权限访问该发布',
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  return handleRequest(params, false);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  return handleRequest(params, true);
}
