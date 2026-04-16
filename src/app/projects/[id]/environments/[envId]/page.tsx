import { notFound, redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentOrNull, getProjectMemberRole } from '@/lib/environments/page-context';
import { getProjectEnvironmentListData } from '@/lib/environments/page-data';

export default async function ProjectEnvironmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; envId: string }>;
}) {
  const session = await auth();
  const { id, envId } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const access = await getProjectMemberRole(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  const initialData = await getProjectEnvironmentListData(id, access.member.role);

  return (
    <EnvironmentsPageClient
      projectId={id}
      initialData={initialData}
      initialEnvId={envId}
      focusMode
    />
  );
}
