import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateProjectForm } from '@/components/projects/create-project-form';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { gitProviders, teamMembers, teams } from '@/lib/db/schema';

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const [provider, userTeams] = await Promise.all([
    db.query.gitProviders.findFirst({
      where: eq(gitProviders.userId, session.user.id),
    }),
    db
      .select({ id: teams.id, name: teams.name, slug: teams.slug })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, session.user.id)),
  ]);

  if (!provider) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Create a project</h1>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-medium mb-2">No Git provider connected</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Connect a Git provider to create projects from your repositories
          </p>
          <Link href="/settings/git-providers">
            <button
              type="button"
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Connect Git Provider
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (userTeams.length === 0) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Create a project</h1>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-medium mb-2">No teams available</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You need to be part of a team to create a project
          </p>
          <Link href="/teams/new">
            <button
              type="button"
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Create a team first
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const providerType =
    provider.type === 'gitlab-self-hosted' ? 'gitlab-self-hosted' : provider.type;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Create a project</h1>
        <p className="text-sm text-muted-foreground mt-1">Deploy your first project in minutes</p>
      </div>

      <CreateProjectForm
        gitProviderType={providerType}
        gitProviderId={provider.id}
        teams={userTeams}
      />
    </div>
  );
}
