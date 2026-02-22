import { eq } from 'drizzle-orm';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {userTeams.length} team{userTeams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/teams/new">
          <Button size="sm" className="h-8">
            <Plus className="h-4 w-4 mr-1.5" />
            New Team
          </Button>
        </Link>
      </div>

      {userTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-2">No teams yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Create your first team to collaborate with others on projects
          </p>
          <Link href="/teams/new">
            <Button>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Team
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
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
                className="p-4 rounded-lg border bg-card hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-muted text-xs font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{item.team.name}</p>
                      <p className="text-xs text-muted-foreground">@{item.team.slug}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded capitalize">{item.role}</span>
                </div>
              </Link>
            );
          })}

          <Link
            href="/teams/new"
            className="p-4 rounded-lg border border-dashed hover:border-foreground/20 transition-colors"
          >
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="p-2 rounded-full bg-muted mb-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Create a team</p>
              <p className="text-xs text-muted-foreground">Start collaborating</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
