import { notFound, redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { listAIPluginsForTeam } from '@/lib/ai/runtime/plugin-registry';
import { getProjectAccessOrNull, getProjectEnvironmentOrNull } from '@/lib/api/page-access';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentListData } from '@/lib/environments/page-data';

export default async function ProjectEnvironmentDetailPage({
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

  const [initialData, initialDynamicPluginPanels] = await Promise.all([
    getProjectEnvironmentListData({
      project: access.project,
      role: access.member.role,
    }),
    listAIPluginsForTeam(access.project.teamId).then((plugins) => {
      const dynamicPlugins = plugins.filter(
        (plugin) =>
          plugin.manifest.kind !== 'core' &&
          plugin.manifest.scope === 'environment' &&
          plugin.manifest.surfaces.some((surface) =>
            ['inline-card', 'action-center', 'task-center'].includes(surface)
          )
      );

      return dynamicPlugins.map((plugin) => ({
        pluginId: plugin.manifest.id,
        snapshot: null,
      }));
    }),
  ]);

  return (
    <EnvironmentsPageClient
      projectId={id}
      initialData={initialData}
      initialEnvId={envId}
      initialAiSummary={null}
      initialMigrationReview={null}
      initialEnvvarRisk={null}
      initialTaskCenter={null}
      initialDynamicPluginPanels={initialDynamicPluginPanels}
      focusMode
    />
  );
}
