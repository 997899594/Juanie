import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { ReleaseDetailDashboard } from '@/components/projects/ReleaseDetailDashboard';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { getReleaseDetailPageData } from '@/lib/releases/service';

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string; releaseId: string }>;
}) {
  const { id, releaseId } = await params;
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

  const pageData = await getReleaseDetailPageData({ projectId: id, releaseId });
  if (!pageData) {
    notFound();
  }
  const [releasePlanSnapshot, incidentSnapshot] = await Promise.all([
    resolveAIPluginSnapshot<ReleasePlan>({
      pluginId: 'release-intelligence',
      context: {
        teamId: project.teamId,
        projectId: id,
        environmentId: pageData.release.environment?.id ?? pageData.release.environmentId,
        releaseId,
        actorUserId: session.user.id,
      },
    }),
    resolveAIPluginSnapshot<IncidentAnalysis>({
      pluginId: 'incident-intelligence',
      context: {
        teamId: project.teamId,
        projectId: id,
        environmentId: pageData.release.environment?.id ?? pageData.release.environmentId,
        releaseId,
        actorUserId: session.user.id,
      },
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
    />
  );
}
