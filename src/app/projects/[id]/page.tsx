import { redirect } from 'next/navigation';
import { ProjectOverviewDashboard } from '@/components/projects/ProjectOverviewDashboard';
import { auth } from '@/lib/auth';
import { getProjectOverviewPageData } from '@/lib/projects/service';

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ new?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectOverviewPageData(id, session.user.id);

  if (!pageData?.project) redirect('/projects');

  return (
    <ProjectOverviewDashboard
      projectId={id}
      pageData={pageData}
      initialCreatePreviewOpen={resolvedSearchParams?.new === 'preview'}
    />
  );
}
