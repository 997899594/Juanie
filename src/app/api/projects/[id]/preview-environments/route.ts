import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectWithRepositoryAccessOrThrow,
  isOwnerOrAdmin,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { launchPreviewEnvironmentFromRef } from '@/lib/environments/preview-launch';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(id, session.user.id);

    const previewEnvironments = await db.query.environments.findMany({
      where: and(eq(environments.projectId, id), eq(environments.isPreview, true)),
    });

    return NextResponse.json(previewEnvironments);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project, member } = await getProjectWithRepositoryAccessOrThrow(id, session.user.id);

    const body = await request.json();
    const branch =
      typeof body.branch === 'string' && body.branch.trim().length > 0 ? body.branch.trim() : null;
    const prNumber =
      typeof body.prNumber === 'number' && Number.isInteger(body.prNumber) && body.prNumber > 0
        ? body.prNumber
        : null;
    const ttlHours =
      typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours) ? body.ttlHours : 72;
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : null;
    const creationDefaults =
      configJson?.creationDefaults && typeof configJson.creationDefaults === 'object'
        ? (configJson.creationDefaults as Record<string, unknown>)
        : null;
    const defaultPreviewDatabaseStrategy =
      creationDefaults?.previewDatabaseStrategy === 'isolated_clone' ? 'isolated_clone' : 'inherit';
    const databaseStrategy =
      body.databaseStrategy === 'isolated_clone'
        ? 'isolated_clone'
        : body.databaseStrategy === 'inherit'
          ? 'inherit'
          : defaultPreviewDatabaseStrategy;

    if (!branch && !prNumber) {
      return NextResponse.json({ error: '预览环境需要分支或 PR 号' }, { status: 400 });
    }
    if (branch && prNumber) {
      return NextResponse.json({ error: '分支和 PR 号一次只能填写一个' }, { status: 400 });
    }
    if (databaseStrategy === 'isolated_clone' && !isOwnerOrAdmin(member.role)) {
      return NextResponse.json({ error: '独立预览库只允许 owner 或 admin 创建' }, { status: 403 });
    }
    if (!project.repository) {
      return NextResponse.json(
        { error: '项目未绑定仓库，暂时无法从分支启动预览环境' },
        { status: 409 }
      );
    }

    const ref = prNumber ? `refs/pull/${prNumber}/merge` : `refs/heads/${branch}`;

    const result = await launchPreviewEnvironmentFromRef({
      projectId: id,
      ref,
      ttlHours,
      databaseStrategy,
      triggeredByUserId: session.user.id,
    });

    return NextResponse.json(
      {
        id: result.environment.id,
        name: result.environment.name,
        launchState: result.launchState,
        releaseId: result.release?.id ?? null,
        releaseStatus: result.release?.status ?? null,
        releasePath: result.release ? `/projects/${id}/delivery/${result.release.id}` : null,
        sourceCommitSha: result.sourceCommitSha,
      },
      { status: 202 }
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
