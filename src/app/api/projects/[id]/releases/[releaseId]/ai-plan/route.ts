import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { resolveReleaseAIPlugin } from '@/lib/ai/runtime/release-plugin-service';
import { type ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';

async function handleRequest(
  params: Promise<{ id: string; releaseId: string }>,
  forceRefresh: boolean
) {
  const { id: projectId, releaseId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const result = await resolveReleaseAIPlugin<ReleasePlan>({
    userId: session.user.id,
    projectId,
    releaseId,
    pluginId: 'release-intelligence',
    forceRefresh,
  });

  if (result.status === 'not_found') {
    return NextResponse.json({ error: '发布不存在' }, { status: 404 });
  }

  if (result.status === 'forbidden') {
    return NextResponse.json({ error: '没有权限访问该发布' }, { status: 403 });
  }

  if (forceRefresh) {
    const release = await db.query.releases.findFirst({
      where: eq(releases.id, releaseId),
      with: {
        project: {
          columns: {
            teamId: true,
          },
        },
      },
    });

    if (release) {
      await createAuditLog({
        teamId: release.project.teamId,
        userId: session.user.id,
        action: 'release.ai_analysis_refreshed',
        resourceType: 'release',
        resourceId: releaseId,
        metadata: {
          pluginId: 'release-intelligence',
          projectId,
        },
      });
    }
  }

  return NextResponse.json(result.payload);
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
