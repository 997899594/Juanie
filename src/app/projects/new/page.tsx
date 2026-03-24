import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateProjectForm } from '@/components/projects/create-project-form';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams } from '@/lib/db/schema';

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userTeams = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, session.user.id));

  if (userTeams.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="新建项目"
          actions={
            <Button asChild variant="outline" className="h-9 rounded-xl px-4">
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Link>
            </Button>
          }
        />

        <div className="console-panel flex min-h-72 flex-col items-center justify-center rounded-[20px] px-8 text-center">
          <h2 className="text-lg font-medium">没有可用团队</h2>
          <p className="mt-2 text-sm text-muted-foreground">先加入团队，才能创建项目。</p>
          <Link href="/teams/new" className="mt-5">
            <Button className="rounded-xl">先创建团队</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="新建项目"
        description={`${userTeams.length} 个团队可用`}
        actions={
          <Button asChild variant="outline" className="h-9 rounded-xl px-4">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />

      <div className="console-panel px-5 py-5">
        <CreateProjectForm teams={userTeams} />
      </div>
    </div>
  );
}
