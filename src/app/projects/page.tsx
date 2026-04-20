import { redirect } from 'next/navigation';
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient';
import { auth } from '@/lib/auth';
import { getProjectsListPageData } from '@/lib/projects/list-service';

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { stats, projectCards } = await getProjectsListPageData(session.user.id);
  return <ProjectsPageClient initialProjectCards={projectCards} initialStats={stats} />;
}
