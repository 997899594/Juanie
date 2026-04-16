import { redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { auth } from '@/lib/auth';
import { getProjectMemberRole } from '@/lib/environments/page-context';
import { getProjectEnvironmentListData } from '@/lib/environments/page-data';

export default async function ProjectEnvironmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const access = await getProjectMemberRole(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const initialData = await getProjectEnvironmentListData(id, access.member.role);

  return <EnvironmentsPageClient projectId={id} initialData={initialData} />;
}
