import { notFound, redirect } from 'next/navigation';
import { EnvVarManager } from '@/components/projects/EnvVarManager';
import { RuntimeSectionNav } from '@/components/projects/RuntimeSectionNav';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentOrNull, getProjectMemberRole } from '@/lib/environments/page-context';

export default async function ProjectEnvironmentVariablesPage({
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
    <div className="space-y-6">
      <PageHeader
        title="变量"
        description={`${environment.name} 的直接配置、实际生效变量与服务级覆盖`}
      />
      <RuntimeSectionNav projectId={id} environmentId={envId} />
      <EnvVarManager
        projectId={id}
        environmentId={environment.id}
        environmentName={environment.name}
        canManage={access.member.role === 'owner' || access.member.role === 'admin'}
        disabledSummary={
          access.member.role === 'owner' || access.member.role === 'admin'
            ? null
            : '环境变量变更只允许 owner 或 admin'
        }
      />
    </div>
  );
}
