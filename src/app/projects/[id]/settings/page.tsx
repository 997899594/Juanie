import { redirect } from 'next/navigation';
import { ProjectSettingsClient } from '@/components/projects/ProjectSettingsClient';
import { auth } from '@/lib/auth';
import { getProjectSettingsPageData } from '@/lib/projects/settings-service';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectSettingsPageData(id, session.user.id);

  if (!pageData) {
    redirect('/projects');
  }

  return <ProjectSettingsClient projectId={id} initialData={pageData} />;
}
