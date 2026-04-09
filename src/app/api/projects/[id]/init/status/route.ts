import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { getProjectInitPageData } from '@/lib/projects/init-service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const pageData = await getProjectInitPageData(id, session.user.id);

    if (!pageData) {
      return NextResponse.json({ error: '项目不存在或无权限访问' }, { status: 404 });
    }

    return NextResponse.json({
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
