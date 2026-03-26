import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProjectInitPageData } from '@/lib/projects/init-service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const pageData = await getProjectInitPageData(id, session.user.id);

  if (!pageData) {
    return NextResponse.json({ error: '项目不存在或无权限访问' }, { status: 404 });
  }

  return NextResponse.json({
    overview: pageData.overview,
  });
}
