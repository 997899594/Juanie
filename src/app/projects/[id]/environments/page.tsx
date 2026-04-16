import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getProjectMemberRole } from '@/lib/environments/page-context';

export default async function ProjectEnvironmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const access = await getProjectMemberRole(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  redirect(`/projects/${id}`);
}
