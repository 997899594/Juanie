import { notFound, redirect } from 'next/navigation';
import { EnvironmentResourcePanel } from '@/components/projects/EnvironmentResourcePanel';
import { EnvironmentSectionNav } from '@/components/projects/EnvironmentSectionNav';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentOrNull, getProjectMemberRole } from '@/lib/environments/page-context';

export default async function ProjectEnvironmentDiagnosticsPage({
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="诊断" description={environment.name} />
      <EnvironmentSectionNav projectId={id} environmentId={envId} />
      <EnvironmentResourcePanel
        projectId={id}
        environmentId={environment.id}
        environmentName={environment.name}
        canManage={access.member.role === 'owner' || access.member.role === 'admin'}
        manageSummary={
          access.member.role === 'owner' || access.member.role === 'admin'
            ? null
            : '生产级治理动作只允许 owner 或 admin'
        }
      />
    </div>
  );
}
