import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
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

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    columns: { id: true, name: true },
  });

  if (!project) redirect('/projects');

  return (
    <ProjectProvider projectId={project.id} projectName={project.name}>
      {children}
    </ProjectProvider>
  );
}
