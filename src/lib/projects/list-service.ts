import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, repositories, teamMembers, teams } from '@/lib/db/schema';
import { buildProjectListStats, decorateProjectListCards } from '@/lib/projects/list-view';

export async function getProjectsListPageData(userId: string) {
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: true,
    },
  });

  const teamIds = userTeams.map((tm) => tm.teamId);
  const teamRoleById = new Map(userTeams.map((membership) => [membership.teamId, membership.role]));

  const userProjects =
    teamIds.length > 0
      ? await db
          .select({
            project: projects,
            teamName: teams.name,
            repoFullName: repositories.fullName,
          })
          .from(projects)
          .innerJoin(teams, eq(teams.id, projects.teamId))
          .leftJoin(repositories, eq(repositories.id, projects.repositoryId))
          .where(inArray(projects.teamId, teamIds))
          .orderBy(desc(projects.createdAt))
      : [];

  const projectIds = userProjects.map((item) => item.project.id);
  const projectEnvironments =
    projectIds.length > 0
      ? await db.query.environments.findMany({
          where: (environment, { inArray }) => inArray(environment.projectId, projectIds),
          columns: {
            id: true,
            name: true,
            isProduction: true,
            isPreview: true,
            deliveryMode: true,
            previewBuildStatus: true,
            projectId: true,
          },
        })
      : [];

  const environmentsByProjectId = new Map<string, typeof projectEnvironments>();
  for (const environment of projectEnvironments) {
    const bucket = environmentsByProjectId.get(environment.projectId) ?? [];
    bucket.push(environment);
    environmentsByProjectId.set(environment.projectId, bucket);
  }

  const projectCards = decorateProjectListCards(
    userProjects.map((item) => ({
      id: item.project.id,
      name: item.project.name,
      status: item.project.status,
      createdAt: item.project.createdAt,
      teamName: item.teamName,
      repositoryFullName: item.repoFullName,
      role: teamRoleById.get(item.project.teamId) ?? 'member',
      environments: environmentsByProjectId.get(item.project.id) ?? [],
    }))
  );

  return {
    headerDescription: `${projectCards.length} 个项目`,
    stats: buildProjectListStats({
      projectCount: projectCards.length,
      teamCount: userTeams.length,
    }),
    projectCards,
  };
}
