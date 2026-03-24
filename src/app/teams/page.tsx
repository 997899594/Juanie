import { eq } from 'drizzle-orm';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams } from '@/lib/db/schema';

export default async function TeamsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userTeams = await db
    .select({
      team: teams,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, session.user.id));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="团队"
        description={`${userTeams.length} 个团队`}
        actions={
          <Button asChild className="h-9 rounded-xl px-4">
            <Link href="/teams/new">
              <Plus className="h-4 w-4" />
              新建团队
            </Link>
          </Button>
        }
      />

      {userTeams.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有团队</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">新建一个团队后再开始协作。</p>
          <Button asChild className="mt-5 rounded-xl">
            <Link href="/teams/new">
              <Plus className="h-4 w-4" />
              新建团队
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {userTeams.map((item) => {
            const initials = item.team.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Link
                key={item.team.id}
                href={`/teams/${item.team.id}`}
                className="console-panel px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl">
                      <AvatarFallback className="rounded-xl bg-secondary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.team.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">@{item.team.slug}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {item.role}
                  </span>
                </div>
              </Link>
            );
          })}

          <Link
            href="/teams/new"
            className="flex min-h-40 flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-background px-5 py-4 text-center transition-colors hover:bg-secondary/30"
          >
            <div className="mb-3 rounded-2xl bg-muted p-3">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm font-semibold">新建团队</div>
            <div className="mt-1 text-xs text-muted-foreground">开始协作</div>
          </Link>
        </div>
      )}
    </div>
  );
}
