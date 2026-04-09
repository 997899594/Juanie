import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, isOwnerOrAdmin, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { ensurePreviewEnvironmentForRef } from '@/lib/environments/service';

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
    const { project, member } = await getProjectAccessOrThrow(id, session.user.id);

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
    if (databaseStrategy === 'isolated_clone' && !isOwnerOrAdmin(member.role)) {
      return NextResponse.json({ error: '独立预览库只允许 owner 或 admin 创建' }, { status: 403 });
    }
    const ref = prNumber ? `refs/pull/${prNumber}/merge` : `refs/heads/${branch}`;

    const environment = await ensurePreviewEnvironmentForRef({
      projectId: id,
      projectSlug: project.slug,
      ref,
      ttlHours,
      databaseStrategy,
    });

    return NextResponse.json(environment, { status: environment ? 201 : 200 });
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
