import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { copilotRequestSchema, generateReleaseCopilotStream } from '@/lib/ai/copilot/service';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { releases, teamMembers } from '@/lib/db/schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id, releaseId } = await params;
  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, releaseId), eq(releases.projectId, id)),
    columns: {
      id: true,
      projectId: true,
      environmentId: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!release) {
    return NextResponse.json({ error: '发布不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, release.project.teamId),
      eq(teamMembers.userId, session.user.id)
    ),
    columns: {
      id: true,
    },
  });

  if (!member) {
    return NextResponse.json({ error: '你没有查看这个发布的权限' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = copilotRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Copilot 请求格式不正确' }, { status: 400 });
  }

  const reply = await generateReleaseCopilotStream({
    projectId: release.projectId,
    releaseId: release.id,
    messages: parsed.data.messages,
  });

  await createAuditLog({
    teamId: release.project.teamId,
    userId: session.user.id,
    action: 'release.copilot_asked',
    resourceType: 'release',
    resourceId: release.id,
    metadata: {
      projectId: release.projectId,
      environmentId: release.environmentId,
      messageCount: parsed.data.messages.length,
      provider: reply.provider,
      model: reply.model,
    },
  }).catch(() => undefined);

  return new Response(reply.stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-AI-Provider': reply.provider,
      'X-AI-Model': reply.model,
      'X-Copilot-Suggestions': encodeURIComponent(JSON.stringify(reply.suggestions)),
    },
  });
}
