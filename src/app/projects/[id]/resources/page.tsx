import { redirect } from 'next/navigation';
import { ResourcesPageClient } from '@/components/projects/ResourcesPageClient';
import { auth } from '@/lib/auth';
import { getProjectObservabilityPageData } from '@/lib/observability/page-data';

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectObservabilityPageData(id, session.user.id);

  if (!pageData) {
    redirect('/projects');
  }

  return (
    <ResourcesPageClient
      projectId={id}
      projectName={pageData.project.name}
      initialData={pageData}
    />
  );
}
