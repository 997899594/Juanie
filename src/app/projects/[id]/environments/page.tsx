import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EnvironmentsPageClient } from '@/components/projects/EnvironmentsPageClient';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { getProjectEnvironmentListData } from '@/lib/environments/page-data';

export default async function EnvironmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

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

  const initialData = await getProjectEnvironmentListData(id, member.role);

  return <EnvironmentsPageClient projectId={id} initialData={initialData} />;
}
