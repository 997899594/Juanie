import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, PageHeaderAction } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { auth } from '@/lib/auth';
import { getTeamsListPageData } from '@/lib/teams/list-service';

export default async function TeamsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { teamCards } = await getTeamsListPageData(session.user.id);
  const shellClassName = 'console-panel';

  return (
    <PageShell size="wide">
      <PageHeader
        title="团队"
        actions={
          <PageHeaderAction
            label="新建团队"
            href="/teams/new"
            icon={<Plus className="h-4 w-4" />}
          />
        }
      />

      {teamCards.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="还没有团队" className="min-h-80" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teamCards.map((team) => {
            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className={`${shellClassName} px-5 py-4 transition-colors hover:bg-white/90`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-[18px]">
                      <AvatarFallback className="rounded-[18px] bg-secondary/80 text-xs font-semibold">
                        {team.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{team.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">@{team.slug}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">团队</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
