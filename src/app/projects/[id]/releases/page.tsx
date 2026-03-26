import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { ReleasesPageClient } from '@/components/projects/ReleasesPageClient';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { getProjectReleasesPageData } from '@/lib/releases/service';

export default async function ReleasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ env?: string; risk?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const { env, risk } = await searchParams;

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

  const pageData = await getProjectReleasesPageData({
    projectId: id,
    role: member.role,
    envFilter: env,
    riskFilter: risk,
  });

  return <ReleasesPageClient projectId={id} initialData={pageData} />;
}
