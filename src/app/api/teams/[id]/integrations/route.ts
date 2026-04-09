import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createTeamIntegrationBinding } from '@/lib/integrations/service/team-binding-service';
import { canManageTeamIntegrations } from '@/lib/policies/runtime-access';
import { getTeamIntegrationsPageData } from '@/lib/teams/service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    await getTeamAccessOrThrow(id, session.user.id);

    const pageData = await getTeamIntegrationsPageData(id, session.user.id);
    if (!pageData) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 });
    }

    return NextResponse.json(pageData.overview);
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
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (!canManageTeamIntegrations(member.role)) {
      return NextResponse.json({ error: '当前角色不能管理集成绑定' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      integrationIdentityId?: string;
      authMode?: 'personal' | 'service';
      label?: string;
      isDefault?: boolean;
    } | null;

    if (!body?.integrationIdentityId) {
      return NextResponse.json({ error: 'integrationIdentityId is required' }, { status: 400 });
    }

    await createTeamIntegrationBinding({
      teamId: id,
      integrationIdentityId: body.integrationIdentityId,
      createdByUserId: session.user.id,
      authMode: body.authMode,
      label: body.label,
      isDefault: body.isDefault,
    });

    const pageData = await getTeamIntegrationsPageData(id, session.user.id);
    return NextResponse.json(pageData?.overview ?? null, { status: 201 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
