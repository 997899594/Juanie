import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessWithRoleOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { deletePreviewEnvironmentById } from '@/lib/environments/cleanup';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const session = await requireSession();
    const { project } = await getProjectAccessWithRoleOrThrow(
      id,
      session.user.id,
      ['owner', 'admin'] as const,
      '没有权限删除预览环境'
    );

    const environment = await db.query.environments.findFirst({
      where: and(eq(environments.id, envId), eq(environments.projectId, id)),
    });

    if (!environment) {
      return NextResponse.json({ error: '预览环境不存在' }, { status: 404 });
    }

    const result = await deletePreviewEnvironmentById(envId);
    if (!result.deleted) {
      if (result.reason === 'active_release') {
        return NextResponse.json(
          { error: '预览环境仍有活跃中的发布，暂时不能删除' },
          { status: 409 }
        );
      }

      if (result.reason === 'not_preview') {
        return NextResponse.json({ error: '目标环境不是预览环境' }, { status: 400 });
      }

      return NextResponse.json({ error: '删除预览环境失败' }, { status: 400 });
    }

    await createAuditLog({
      teamId: project.teamId,
      userId: session.user.id,
      action: 'environment.preview_deleted',
      resourceType: 'environment',
      resourceId: envId,
      metadata: {
        projectId: id,
        environmentId: envId,
        environmentName: environment.name,
        mode: 'manual',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
