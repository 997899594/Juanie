import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { getProjectEnvironmentListData } from '@/lib/environments/page-data';

export default async function RuntimePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ env?: string; panel?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

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

  const initialData = await getProjectEnvironmentListData(id, member.role);

  return (
    <EnvironmentsPageClient
      projectId={id}
      initialData={initialData}
      initialEnvId={resolvedSearchParams?.env ?? null}
      initialDiagnosticsEnvId={
        resolvedSearchParams?.panel === 'diagnostics' ? (resolvedSearchParams?.env ?? null) : null
      }
    />
  );
}
