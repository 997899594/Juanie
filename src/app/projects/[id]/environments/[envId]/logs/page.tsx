import { notFound, redirect } from 'next/navigation';
import { LogsPageClient } from '@/components/projects/LogsPageClient';
import { getProjectEnvironmentOrNull } from '@/lib/api/page-access';
import { auth } from '@/lib/auth';
import { getProjectObservabilityPageData } from '@/lib/observability/page-data';

export default async function ProjectEnvironmentLogsPage({
  params,
}: {
  params: Promise<{ id: string; envId: string }>;
}) {
  const session = await auth();
  const { id, envId } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectObservabilityPageData(id, session.user.id);
  if (!pageData) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  return (
    <LogsPageClient
      projectId={id}
      projectName={pageData.project.name}
      initialData={pageData}
      initialEnvId={envId}
    />
  );
}
