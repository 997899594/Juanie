import { redirect } from 'next/navigation';
import { ProjectOverviewDashboard } from '@/components/projects/ProjectOverviewDashboard';
import { auth } from '@/lib/auth';
import { getProjectOverviewPageData } from '@/lib/projects/service';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectOverviewPageData(id, session.user.id);

  if (!pageData?.project) redirect('/projects');

  return <ProjectOverviewDashboard projectId={id} pageData={pageData} />;
}
