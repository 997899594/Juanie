import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { ReleaseDetailDashboard } from '@/components/projects/ReleaseDetailDashboard';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
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
    redirect(buildReleaseDetailPath(id, releaseEnvironmentId, releaseId));
  }

  return (
    <ReleaseDetailDashboard
      projectId={id}
      releaseId={releaseId}
      role={member.role}
      pageData={pageData}
      initialTaskCenter={null}
    />
  );
}
