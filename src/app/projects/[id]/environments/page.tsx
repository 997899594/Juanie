import { redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { auth } from '@/lib/auth';
import { getProjectMemberRole } from '@/lib/environments/page-context';
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

  const access = await getProjectMemberRole(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  if (resolvedSearchParams?.new === 'preview') {
    const initialData = await getProjectEnvironmentListData(id, access.member.role);

    return <EnvironmentsPageClient projectId={id} initialData={initialData} initialCreateOpen />;
  }

  redirect(`/projects/${id}`);
}
