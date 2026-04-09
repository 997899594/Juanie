import { NextResponse } from 'next/server';
import { getTeamAIControlPlane, updateTeamAIControlPlane } from '@/lib/ai/runtime/control-plane';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    await getTeamAccessOrThrow(id, session.user.id);

    const snapshot = await getTeamAIControlPlane(id);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (member.role !== 'owner') {
      return NextResponse.json({ error: '只有 owner 可以修改 AI 控制面' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      plan?: 'free' | 'pro' | 'scale' | 'enterprise';
      plugins?: Array<{ pluginId: string; enabled: boolean }>;
    } | null;

    if (!body?.plan || !Array.isArray(body.plugins)) {
      return NextResponse.json({ error: 'AI 配置不完整' }, { status: 400 });
    }

    const snapshot = await updateTeamAIControlPlane({
      teamId: id,
      plan: body.plan,
      plugins: body.plugins,
    });

    await createAuditLog({
      teamId: id,
      userId: session.user.id,
      action: 'team.ai_control_plane_updated',
      resourceType: 'team',
      resourceId: id,
      metadata: {
        plan: body.plan,
        plugins: body.plugins,
      },
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
