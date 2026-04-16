import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { SchemaCenterClient } from '@/components/projects/SchemaCenterClient';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { getProjectSchemaCenterData } from '@/lib/schema-management/page-data';

export default async function ProjectSchemaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ env?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const envId = resolvedSearchParams?.env ?? null;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    redirect('/projects');
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    redirect('/projects');
  }

  const initialData = await getProjectSchemaCenterData(id, member.role, envId);

  return <SchemaCenterClient projectId={id} initialData={initialData} initialEnvId={envId} />;
}
