import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { ReleaseDetailDashboard } from '@/components/projects/ReleaseDetailDashboard';
import { listAIPluginsForTeam } from '@/lib/ai/runtime/plugin-registry';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { getReleaseTaskCenterData } from '@/lib/ai/tasks/release-task-center';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { getReleaseDetailPageData } from '@/lib/releases/service';

export default async function EnvironmentDeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string; envId: string; releaseId: string }>;
}) {
  const { id, envId, releaseId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    notFound();
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) {
    redirect('/projects');
  }

  const pageData = await getReleaseDetailPageData({
    projectId: id,
    releaseId,
    actorUserId: session.user.id,
  });
  if (!pageData) {
    notFound();
  }

  const releaseEnvironmentId = pageData.release.environment?.id ?? pageData.release.environmentId;
  if (releaseEnvironmentId !== envId) {
    notFound();
  }

  const [releasePlanSnapshot, incidentSnapshot, dynamicPluginPanels, initialTaskCenter] =
    await Promise.all([
      resolveAIPluginSnapshot<ReleasePlan>({
        pluginId: 'release-intelligence',
        context: {
          teamId: project.teamId,
          projectId: id,
          environmentId: releaseEnvironmentId,
          releaseId,
          actorUserId: session.user.id,
        },
      }),
      resolveAIPluginSnapshot<IncidentAnalysis>({
        pluginId: 'incident-intelligence',
        context: {
          teamId: project.teamId,
          projectId: id,
          environmentId: releaseEnvironmentId,
          releaseId,
          actorUserId: session.user.id,
        },
      }),
      listAIPluginsForTeam(project.teamId).then(async (plugins) => {
        const dynamicPlugins = plugins.filter(
          (plugin) =>
            plugin.manifest.kind !== 'core' &&
            plugin.manifest.scope === 'release' &&
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
                teamId: project.teamId,
                projectId: id,
                environmentId: releaseEnvironmentId,
                releaseId,
                actorUserId: session.user.id,
              },
            }),
          }))
        );
      }),
      getReleaseTaskCenterData({
        projectId: id,
        releaseId,
        actorUserId: session.user.id,
      }),
    ]);

  return (
    <ReleaseDetailDashboard
      projectId={id}
      releaseId={releaseId}
      role={member.role}
      pageData={pageData}
      releasePlanSnapshot={releasePlanSnapshot}
      incidentSnapshot={incidentSnapshot}
      dynamicPluginPanels={dynamicPluginPanels}
      initialTaskCenter={initialTaskCenter}
    />
  );
}
