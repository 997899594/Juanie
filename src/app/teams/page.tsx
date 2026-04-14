import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { getTeamsListPageData } from '@/lib/teams/list-service';

export default async function TeamsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { teamCards } = await getTeamsListPageData(session.user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="团队"
        actions={
          <Button asChild className="h-9 rounded-xl px-4">
            <Link href="/teams/new">
              <Plus className="h-4 w-4" />
              新建团队
            </Link>
          </Button>
        }
      />

      {teamCards.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有团队</h2>
          <Button asChild className="mt-5 rounded-xl">
            <Link href="/teams/new">
              <Plus className="h-4 w-4" />
              新建团队
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teamCards.map((team) => {
            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="console-panel px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl">
                      <AvatarFallback className="rounded-xl bg-secondary text-xs font-semibold">
                        {team.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{team.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        @{team.slug} · {team.roleLabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">团队</div>
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
          </Link>
        </div>
      )}
    </div>
  );
}
