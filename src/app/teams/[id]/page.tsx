import { eq } from 'drizzle-orm';
import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const projectsList = await db.query.projects.findMany({
    where: eq(projects.teamId, id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {projectsList.length} project{projectsList.length !== 1 ? 's' : ''}
        </p>
        <Link href="/projects/new">
          <Button size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Project
          </Button>
        </Link>
      </div>

      {projectsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-base font-medium mb-1">No projects yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create a project to start deploying to this team
          </p>
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {projectsList.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:border-foreground/20 transition-colors"
            >
              <div className="p-2 rounded-md bg-muted shrink-0">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  {project.status ?? 'active'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
