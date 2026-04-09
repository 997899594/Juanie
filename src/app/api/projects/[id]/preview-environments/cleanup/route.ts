import { NextResponse } from 'next/server';
import { getProjectAccessWithRoleOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';
import { cleanupExpiredPreviewEnvironments } from '@/lib/environments/cleanup';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project } = await getProjectAccessWithRoleOrThrow(
      id,
      session.user.id,
      ['owner', 'admin'] as const,
      '没有权限执行预览环境治理'
    );

    const result = await cleanupExpiredPreviewEnvironments({
      projectId: id,
    });

    await createAuditLog({
      teamId: project.teamId,
      userId: session.user.id,
      action: 'environment.preview_cleanup_completed',
      resourceType: 'environment',
      metadata: {
        projectId: id,
        deletedIds: result.deletedIds,
        skipped: result.skipped,
        deletedCount: result.deletedIds.length,
        blockedCount: result.skipped.filter((item) => item.reason === 'active_release').length,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
