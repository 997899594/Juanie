import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import {
  revokeTeamIntegrationBinding,
  setDefaultTeamIntegrationBinding,
} from '@/lib/integrations/service/team-binding-service';
import { canManageTeamIntegrations } from '@/lib/policies/runtime-access';
import { getTeamIntegrationsPageData } from '@/lib/teams/service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; bindingId: string }> }
) {
  try {
    const { id, bindingId } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (!canManageTeamIntegrations(member.role)) {
      return NextResponse.json({ error: '当前角色不能管理集成绑定' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      action?: 'set_default';
      isDefault?: boolean;
    } | null;

    const shouldSetDefault = body?.action === 'set_default' || body?.isDefault === true;
    if (!shouldSetDefault) {
      return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 });
    }

    const updated = await setDefaultTeamIntegrationBinding(id, bindingId);
    if (!updated) {
      return NextResponse.json({ error: '没有找到这个绑定' }, { status: 404 });
    }

    const pageData = await getTeamIntegrationsPageData(id, session.user.id);
    return NextResponse.json(pageData?.overview ?? null);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bindingId: string }> }
) {
  try {
    const { id, bindingId } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (!canManageTeamIntegrations(member.role)) {
      return NextResponse.json({ error: '当前角色不能管理集成绑定' }, { status: 403 });
    }

    const revoked = await revokeTeamIntegrationBinding(id, bindingId);
    if (!revoked) {
      return NextResponse.json({ error: '没有找到这个绑定' }, { status: 404 });
    }

    const pageData = await getTeamIntegrationsPageData(id, session.user.id);
    return NextResponse.json(pageData?.overview ?? null);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
