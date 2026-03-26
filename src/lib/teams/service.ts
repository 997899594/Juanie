import { and, count, desc, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, teamInvitations, teamMembers, teams, users } from '@/lib/db/schema';
import {
  buildTeamLayoutView,
  buildTeamMembersView,
  buildTeamOverviewView,
  buildTeamSettingsView,
} from '@/lib/teams/view';

async function getTeamAccess(teamId: string, userId: string) {
  const [team, member] = await Promise.all([
    db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    }),
    db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    }),
  ]);

  if (!team || !member) {
    return null;
  }

  return { team, member };
}

export async function getTeamLayoutData(teamId: string, userId: string) {
  const access = await getTeamAccess(teamId, userId);

  if (!access) {
    return null;
  }

  return {
    team: access.team,
    member: access.member,
    layout: buildTeamLayoutView(access.team),
  };
}

export async function getTeamOverviewPageData(teamId: string, userId: string) {
  const access = await getTeamAccess(teamId, userId);

  if (!access) {
    return null;
  }

  const [projectsList, memberCountResult] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projects.teamId, teamId),
      with: {
        environments: true,
      },
      orderBy: [desc(projects.createdAt)],
    }),
    db.select({ count: count() }).from(teamMembers).where(eq(teamMembers.teamId, teamId)),
  ]);

  return {
    team: access.team,
    member: access.member,
    overview: buildTeamOverviewView({
      role: access.member.role,
      memberCount: memberCountResult[0]?.count ?? 0,
      projects: projectsList,
    }),
  };
}

export async function getTeamMembersPageData(teamId: string, userId: string) {
  const access = await getTeamAccess(teamId, userId);

  if (!access) {
    return null;
  }

  const now = new Date();
  const [members, invitations] = await Promise.all([
    db
      .select({
        id: teamMembers.id,
        role: teamMembers.role,
        createdAt: teamMembers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId)),
    ['owner', 'admin'].includes(access.member.role)
      ? db.query.teamInvitations.findMany({
          where: and(eq(teamInvitations.teamId, teamId), gt(teamInvitations.expires, now)),
          orderBy: [desc(teamInvitations.createdAt)],
        })
      : Promise.resolve([]),
  ]);

  return {
    team: access.team,
    member: access.member,
    overview: buildTeamMembersView({
      role: access.member.role,
      currentUserId: userId,
      members,
      invitations,
    }),
  };
}

export async function getTeamSettingsPageData(teamId: string, userId: string) {
  const access = await getTeamAccess(teamId, userId);

  if (!access) {
    return null;
  }

  const [projectCountResult, memberCountResult] = await Promise.all([
    db.select({ count: count() }).from(projects).where(eq(projects.teamId, teamId)),
    db.select({ count: count() }).from(teamMembers).where(eq(teamMembers.teamId, teamId)),
  ]);

  return {
    team: access.team,
    member: access.member,
    overview: buildTeamSettingsView({
      role: access.member.role,
      projectCount: projectCountResult[0]?.count ?? 0,
      memberCount: memberCountResult[0]?.count ?? 0,
    }),
  };
}
