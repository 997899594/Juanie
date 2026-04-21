import { notFound, redirect } from 'next/navigation';
import { SchemaCenterClient } from '@/components/projects/SchemaCenterClient';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentOrNull, getProjectMemberRole } from '@/lib/environments/page-context';
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

  const access = await getProjectMemberRole(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  const initialData = await getProjectSchemaCenterData(id, access.member.role, envId);

  return <SchemaCenterClient projectId={id} initialData={initialData} initialEnvId={envId} />;
}
