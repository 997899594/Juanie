import { notFound, redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { listAIPluginsForTeam } from '@/lib/ai/runtime/plugin-registry';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';
import type { MigrationReview } from '@/lib/ai/schemas/migration-review';
import { getEnvironmentTaskCenterData } from '@/lib/ai/tasks/environment-task-center';
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

  const [
    initialData,
    initialAiSummary,
    initialMigrationReview,
    initialEnvvarRisk,
    initialTaskCenter,
    initialDynamicPluginPanels,
  ] = await Promise.all([
    getProjectEnvironmentListData({
      project: access.project,
      role: access.member.role,
    }),
    resolveAIPluginSnapshot<EnvironmentSummary>({
      pluginId: 'environment-summary',
      context: {
        teamId: access.project.teamId,
        projectId: id,
        environmentId: envId,
        actorUserId: session.user.id,
      },
    }),
    resolveAIPluginSnapshot<MigrationReview>({
      pluginId: 'migration-review',
      context: {
        teamId: access.project.teamId,
        projectId: id,
        environmentId: envId,
        actorUserId: session.user.id,
      },
    }),
    resolveAIPluginSnapshot<EnvvarRisk>({
      pluginId: 'envvar-risk',
      context: {
        teamId: access.project.teamId,
        projectId: id,
        environmentId: envId,
        actorUserId: session.user.id,
      },
    }),
    getEnvironmentTaskCenterData({
      projectId: id,
      environmentId: envId,
      actorUserId: session.user.id,
    }),
    listAIPluginsForTeam(access.project.teamId).then(async (plugins) => {
      const dynamicPlugins = plugins.filter(
        (plugin) =>
          plugin.manifest.kind !== 'core' &&
          plugin.manifest.scope === 'environment' &&
          plugin.manifest.surfaces.some((surface) =>
            ['inline-card', 'action-center', 'task-center'].includes(surface)
          )
      );

      return Promise.all(
        dynamicPlugins.map(async (plugin) => ({
          pluginId: plugin.manifest.id,
          snapshot: await resolveAIPluginSnapshot<DynamicPluginOutput>({
            pluginId: plugin.manifest.id,
            context: {
              teamId: access.project.teamId,
              projectId: id,
              environmentId: envId,
              actorUserId: session.user.id,
            },
          }),
        }))
      );
    }),
  ]);

  return (
    <EnvironmentsPageClient
      projectId={id}
      initialData={initialData}
      initialEnvId={envId}
      initialAiSummary={initialAiSummary}
      initialMigrationReview={initialMigrationReview}
      initialEnvvarRisk={initialEnvvarRisk}
      initialTaskCenter={initialTaskCenter}
      initialDynamicPluginPanels={initialDynamicPluginPanels}
      focusMode
    />
  );
}
