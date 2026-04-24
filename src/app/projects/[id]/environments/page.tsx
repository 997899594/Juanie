import { redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { getProjectAccessOrNull } from '@/lib/api/page-access';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentListData } from '@/lib/environments/page-data';

export default async function ProjectEnvironmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const access = await getProjectAccessOrNull(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const initialData = await getProjectEnvironmentListData({
    project: access.project,
    role: access.member.role,
  });

  if (resolvedSearchParams?.new === 'preview') {
    return <EnvironmentsPageClient projectId={id} initialData={initialData} initialCreateOpen />;
  }

  return <EnvironmentsPageClient projectId={id} initialData={initialData} />;
}
