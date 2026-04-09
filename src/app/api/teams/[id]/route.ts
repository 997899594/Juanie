import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { teams } from '@/lib/db/schema';
import { getTeamSettingsPageData } from '@/lib/teams/service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    await getTeamAccessOrThrow(id, session.user.id);

    const pageData = await getTeamSettingsPageData(id, session.user.id);

    if (!pageData) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 });
    }

    return NextResponse.json({
      id: pageData.team.id,
      name: pageData.team.name,
      slug: pageData.team.slug,
      yourRole: pageData.member.role,
      governance: pageData.overview.governance,
      aiControlPlane: pageData.aiControlPlane,
      overview: pageData.overview,
    });
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
      return NextResponse.json({ error: '只有 owner 可以修改团队' }, { status: 403 });
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: '团队名称不能为空' }, { status: 400 });
    }

    const [updated] = await db
      .update(teams)
      .set({ name, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (member.role !== 'owner') {
      return NextResponse.json({ error: '只有 owner 可以删除团队' }, { status: 403 });
    }

    await db.delete(teams).where(eq(teams.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
