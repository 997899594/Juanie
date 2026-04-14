import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { ProjectWorkflowNav } from '@/components/projects/ProjectWorkflowNav';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { ProjectProvider } from '@/lib/project-context';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) notFound();

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) notFound();

  return (
    <ProjectProvider projectId={project.id} projectName={project.name}>
      <div className="space-y-6">
        <ProjectWorkflowNav projectId={project.id} />
        {children}
      </div>
    </ProjectProvider>
  );
}
