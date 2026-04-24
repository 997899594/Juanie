import { and, count, desc, eq, gt, inArray } from 'drizzle-orm';
import { getTeamAIControlPlane } from '@/lib/ai/runtime/control-plane';
import { getTeamAccessOrNull } from '@/lib/api/page-access';
import { db } from '@/lib/db';
import {
  auditLogs,
  integrationGrants,
  integrationIdentities,
  projects,
  teamIntegrationBindings,
  teamInvitations,
  teamMembers,
  users,
} from '@/lib/db/schema';
import { backfillOwnerBindingForTeam } from '@/lib/integrations/service/team-binding-service';
import {
  buildTeamAIActivityView,
  buildTeamIntegrationsView,
  buildTeamLayoutView,
  buildTeamMembersView,
  buildTeamOverviewView,
  buildTeamSettingsView,
} from '@/lib/teams/view';

export async function getTeamLayoutData(teamId: string, userId: string) {
  const access = await getTeamAccessOrNull(teamId, userId);

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
  const access = await getTeamAccessOrNull(teamId, userId);

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
  const access = await getTeamAccessOrNull(teamId, userId);

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
  const access = await getTeamAccessOrNull(teamId, userId);

  if (!access) {
    return null;
  }

  const [projectCountResult, memberCountResult, aiControlPlane, aiActivityRows] = await Promise.all(
    [
      db.select({ count: count() }).from(projects).where(eq(projects.teamId, teamId)),
      db.select({ count: count() }).from(teamMembers).where(eq(teamMembers.teamId, teamId)),
      getTeamAIControlPlane(teamId),
      db.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.teamId, teamId),
          inArray(auditLogs.action, [
            'team.ai_control_plane_updated',
            'release.ai_analysis_refreshed',
          ])
        ),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 6,
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]
  );

  return {
    team: access.team,
    member: access.member,
    aiControlPlane,
    aiActivity: buildTeamAIActivityView(aiActivityRows),
    overview: buildTeamSettingsView({
      role: access.member.role,
      projectCount: projectCountResult[0]?.count ?? 0,
      memberCount: memberCountResult[0]?.count ?? 0,
    }),
  };
}

export async function getTeamIntegrationsPageData(teamId: string, userId: string) {
  const access = await getTeamAccessOrNull(teamId, userId);

  if (!access) {
    return null;
  }

  await backfillOwnerBindingForTeam(teamId);

  const bindings = await db.query.teamIntegrationBindings.findMany({
    where: eq(teamIntegrationBindings.teamId, teamId),
    orderBy: (table, { desc }) => [desc(table.isDefault), desc(table.createdAt)],
  });

  const identityIds = Array.from(
    new Set(bindings.map((binding) => binding.integrationIdentityId).filter(Boolean))
  );

  const [identities, grants] = await Promise.all([
    identityIds.length > 0
      ? db.query.integrationIdentities.findMany({
          where: inArray(integrationIdentities.id, identityIds),
        })
      : Promise.resolve([]),
    identityIds.length > 0
      ? db.query.integrationGrants.findMany({
          where: inArray(integrationGrants.integrationIdentityId, identityIds),
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        })
      : Promise.resolve([]),
  ]);

  const identityById = new Map(identities.map((identity) => [identity.id, identity]));
  const latestGrantByIdentityId = new Map<string, typeof integrationGrants.$inferSelect>();
  for (const grant of grants) {
    if (!latestGrantByIdentityId.has(grant.integrationIdentityId)) {
      latestGrantByIdentityId.set(grant.integrationIdentityId, grant);
    }
  }

  const ownerUserIds = Array.from(
    new Set(identities.map((identity) => identity.userId).filter(Boolean))
  );
  const [ownerUsers, activeMembers] = await Promise.all([
    ownerUserIds.length > 0
      ? db.query.users.findMany({
          where: inArray(users.id, ownerUserIds),
        })
      : Promise.resolve([]),
    ownerUserIds.length > 0
      ? db.query.teamMembers.findMany({
          where: and(eq(teamMembers.teamId, teamId), inArray(teamMembers.userId, ownerUserIds)),
        })
      : Promise.resolve([]),
  ]);

  const ownerById = new Map(
    ownerUsers.map((user) => [user.id, user.name?.trim() || user.email || user.id])
  );
  const activeMemberUserIds = new Set(activeMembers.map((member) => member.userId));

  return {
    team: access.team,
    member: access.member,
    overview: buildTeamIntegrationsView({
      role: access.member.role,
      bindings: bindings.map((binding) => {
        const identity = identityById.get(binding.integrationIdentityId);
        const latestGrant = latestGrantByIdentityId.get(binding.integrationIdentityId);
        const identityOwnerUserId = identity?.userId ?? null;

        return {
          id: binding.id,
          label: binding.label,
          provider: identity?.provider ?? 'unknown',
          authMode: binding.authMode,
          isDefault: binding.isDefault,
          revokedAt: binding.revokedAt,
          grantRevokedAt: latestGrant?.revokedAt ?? null,
          grantExpiresAt: latestGrant?.expiresAt ?? null,
          identityOwner: identityOwnerUserId ? (ownerById.get(identityOwnerUserId) ?? null) : null,
          ownerStillMember: identityOwnerUserId
            ? activeMemberUserIds.has(identityOwnerUserId)
            : false,
        };
      }),
    }),
  };
}
