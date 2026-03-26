import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { teamMembers, teams } from '@/lib/db/schema';
import { decorateTeamListCards } from '@/lib/teams/list-view';

export async function getTeamsListPageData(userId: string) {
  const userTeams = await db
    .select({
      team: teams,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));

  return {
    headerDescription: `${userTeams.length} 个团队`,
    teamCards: decorateTeamListCards(
      userTeams.map((item) => ({
        id: item.team.id,
        name: item.team.name,
        slug: item.team.slug,
        role: item.role,
      }))
    ),
  };
}
