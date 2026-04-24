import { notFound, redirect } from 'next/navigation';
import { SchemaCenterClient } from '@/components/projects/SchemaCenterClient';
import { getProjectAccessOrNull, getProjectEnvironmentOrNull } from '@/lib/api/page-access';
import { auth } from '@/lib/auth';
import { getProjectSchemaCenterData } from '@/lib/schema-management/page-data';

export default async function EnvironmentSchemaPage({
  params,
}: {
  params: Promise<{ id: string; envId: string }>;
}) {
  const session = await auth();
  const { id, envId } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const access = await getProjectAccessOrNull(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  const initialData = await getProjectSchemaCenterData({
    project: access.project,
    role: access.member.role,
    selectedEnvId: envId,
  });

  return <SchemaCenterClient projectId={id} initialData={initialData} initialEnvId={envId} />;
}
