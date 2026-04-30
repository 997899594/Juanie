import { notFound, redirect } from 'next/navigation';
import { EnvironmentPageFrame } from '@/components/projects/EnvironmentPageFrame';
import { EnvironmentResourcePanel } from '@/components/projects/EnvironmentResourcePanel';
import { getProjectAccessOrNull, getProjectEnvironmentOrNull } from '@/lib/api/page-access';
import { auth } from '@/lib/auth';

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
      title="诊断"
      description={`${environment.name} · 定位资源异常和运行阻塞`}
    >
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
    </EnvironmentPageFrame>
  );
}
