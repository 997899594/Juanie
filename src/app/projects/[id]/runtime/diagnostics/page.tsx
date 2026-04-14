import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EnvironmentResourcePanel } from '@/components/projects/EnvironmentResourcePanel';
import { RuntimeSectionNav } from '@/components/projects/RuntimeSectionNav';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';

export default async function RuntimeDiagnosticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ env?: string }>;
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

  const environment =
    (resolvedSearchParams?.env
      ? await db.query.environments.findFirst({
          where: and(eq(environments.id, resolvedSearchParams.env), eq(environments.projectId, id)),
        })
      : null) ??
    (await db.query.environments.findFirst({
      where: eq(environments.projectId, id),
      orderBy: (table, { desc, asc }) => [desc(table.isProduction), asc(table.createdAt)],
    }));

  if (!environment) {
    redirect(`/projects/${id}/runtime`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="运行诊断" description={`${environment.name} 的资源与诊断视图`} />
      <RuntimeSectionNav projectId={id} />
      <EnvironmentResourcePanel
        projectId={id}
        environmentId={environment.id}
        environmentName={environment.name}
        canManage={member.role === 'owner' || member.role === 'admin'}
        manageSummary={
          member.role === 'owner' || member.role === 'admin'
            ? null
            : '生产级治理动作只允许 owner 或 admin'
        }
      />
    </div>
  );
}
