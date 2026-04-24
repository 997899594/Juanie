import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { copilotRequestSchema, generateEnvironmentCopilotStream } from '@/lib/ai/copilot/service';
import { createCopilotEventStream } from '@/lib/ai/copilot/transport';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, teamMembers } from '@/lib/db/schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id, envId } = await params;
  const environment = await db.query.environments.findFirst({
    where: and(eq(environments.id, envId), eq(environments.projectId, id)),
    columns: {
      id: true,
      projectId: true,
      name: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!environment) {
    return NextResponse.json({ error: '环境不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, environment.project.teamId),
      eq(teamMembers.userId, session.user.id)
    ),
    columns: {
      id: true,
    },
  });

  if (!member) {
    return NextResponse.json({ error: '你没有查看这个环境的权限' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = copilotRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Copilot 请求格式不正确' }, { status: 400 });
  }

  const reply = await generateEnvironmentCopilotStream({
    teamId: environment.project.teamId,
    projectId: environment.projectId,
    environmentId: environment.id,
    actorUserId: session.user.id,
    messages: parsed.data.messages,
  });

  await createAuditLog({
    teamId: environment.project.teamId,
    userId: session.user.id,
    action: 'environment.copilot_asked',
    resourceType: 'environment',
    resourceId: environment.id,
    metadata: {
      projectId: environment.projectId,
      messageCount: parsed.data.messages.length,
      conversationId: reply.conversationId,
      provider: reply.provider,
      model: reply.model,
      skillId: reply.skillId,
      promptKey: reply.promptKey,
      promptVersion: reply.promptVersion,
      toolCalls: reply.toolCalls,
      usage: reply.usage,
    },
  }).catch(() => undefined);

  return new Response(
    createCopilotEventStream({
      metadata: {
        conversationId: reply.conversationId,
        generatedAt: reply.generatedAt,
        provider: reply.provider,
        model: reply.model,
        suggestions: reply.suggestions,
        skillId: reply.skillId,
        promptKey: reply.promptKey,
        promptVersion: reply.promptVersion,
        toolCalls: reply.toolCalls,
        usage: reply.usage,
      },
      textStream: reply.stream,
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'keep-alive',
      },
    }
  );
}
