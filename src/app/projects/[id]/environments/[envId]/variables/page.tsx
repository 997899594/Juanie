import { notFound, redirect } from 'next/navigation';
import { EnvironmentPageFrame } from '@/components/projects/EnvironmentPageFrame';
import { EnvVarManager } from '@/components/projects/EnvVarManager';
import { getProjectAccessOrNull, getProjectEnvironmentOrNull } from '@/lib/api/page-access';
import { auth } from '@/lib/auth';

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

  const access = await getProjectAccessOrNull(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  return (
    <EnvironmentPageFrame
      projectId={id}
      environmentId={envId}
      title="变量"
      description={`${environment.name} · 管理直配、继承和服务覆盖`}
    >
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
    </EnvironmentPageFrame>
  );
}
