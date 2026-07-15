import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { approveReleaseMigrationPlanForActor } from '@/lib/migrations/release-plan-control-service';
import { toMigrationRouteErrorResponse } from '@/lib/migrations/route-response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id: projectId, releaseId } = await params;
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'approve' || typeof body.approvalToken !== 'string') {
      return NextResponse.json({ error: '审批请求无效' }, { status: 400 });
    }
    const result = await approveReleaseMigrationPlanForActor({
      actorUserId: session.user.id,
      projectId,
      releaseId,
      approvalToken: body.approvalToken,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return toMigrationRouteErrorResponse(error, '迁移计划审批失败');
  }
}
