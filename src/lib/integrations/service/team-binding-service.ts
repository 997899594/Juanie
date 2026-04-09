import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type IntegrationAuthMode,
  integrationIdentities,
  teamIntegrationBindings,
  teamMembers,
} from '@/lib/db/schema';

type TeamIntegrationBindingRecord = typeof teamIntegrationBindings.$inferSelect;

type ListTeamIntegrationBindingsOptions = {
  includeRevoked?: boolean;
};

export interface TeamIntegrationBindingSummary {
  id: string;
  teamId: string;
  integrationIdentityId: string;
  sourceUserId: string;
  authMode: IntegrationAuthMode;
  isDefault: boolean;
  revokedAt: Date | null;
}

type CreateTeamIntegrationBindingInput = {
  teamId: string;
  integrationIdentityId: string;
  createdByUserId?: string | null;
  authMode?: IntegrationAuthMode;
  label?: string | null;
  isDefault?: boolean;
};

export function chooseDefaultBinding<T extends { isDefault: boolean; revokedAt: Date | null }>(
  bindings: T[]
): T | null {
  const activeBindings = bindings.filter((binding) => binding.revokedAt === null);
  if (activeBindings.length === 0) {
    return null;
  }

  const explicitDefault = activeBindings.find((binding) => binding.isDefault);
  return explicitDefault ?? activeBindings[0] ?? null;
}

export async function listTeamIntegrationBindings(
  teamId: string,
  options?: ListTeamIntegrationBindingsOptions
): Promise<TeamIntegrationBindingRecord[]> {
  return db.query.teamIntegrationBindings.findMany({
    where:
      options?.includeRevoked === true
        ? eq(teamIntegrationBindings.teamId, teamId)
        : and(
            eq(teamIntegrationBindings.teamId, teamId),
            isNull(teamIntegrationBindings.revokedAt)
          ),
    orderBy: (table, { desc }) => [desc(table.isDefault), desc(table.createdAt)],
  });
}

export async function listTeamIntegrationBindingSummaries(
  teamId: string,
  options?: ListTeamIntegrationBindingsOptions
): Promise<TeamIntegrationBindingSummary[]> {
  const bindings = await listTeamIntegrationBindings(teamId, options);
  if (bindings.length === 0) {
    return [];
  }

  const identityIds = Array.from(
    new Set(bindings.map((binding) => binding.integrationIdentityId).filter(Boolean))
  );
  const identities =
    identityIds.length > 0
      ? await db.query.integrationIdentities.findMany({
          where: inArray(integrationIdentities.id, identityIds),
        })
      : [];
  const sourceUserByIdentityId = new Map(
    identities.map((identity) => [identity.id, identity.userId])
  );

  return bindings.flatMap((binding) => {
    const sourceUserId = sourceUserByIdentityId.get(binding.integrationIdentityId);
    if (!sourceUserId) {
      return [];
    }

    return [
      {
        id: binding.id,
        teamId: binding.teamId,
        integrationIdentityId: binding.integrationIdentityId,
        sourceUserId,
        authMode: binding.authMode,
        isDefault: binding.isDefault,
        revokedAt: binding.revokedAt,
      },
    ];
  });
}

export async function createTeamIntegrationBinding(
  input: CreateTeamIntegrationBindingInput
): Promise<TeamIntegrationBindingRecord> {
  const identity = await db.query.integrationIdentities.findFirst({
    where: eq(integrationIdentities.id, input.integrationIdentityId),
  });

  if (!identity) {
    throw new Error('Integration identity not found');
  }

  const activeBindings = await listTeamIntegrationBindings(input.teamId);
  const existingBinding = activeBindings.find(
    (binding) => binding.integrationIdentityId === input.integrationIdentityId
  );

  if (existingBinding) {
    const shouldSetDefault = input.isDefault === true && !existingBinding.isDefault;
    const shouldUpdateMeta =
      (input.label !== undefined && input.label !== existingBinding.label) ||
      (input.authMode !== undefined && input.authMode !== existingBinding.authMode);

    let record = existingBinding;

    if (shouldUpdateMeta) {
      const [updated] = await db
        .update(teamIntegrationBindings)
        .set({
          label: input.label ?? existingBinding.label,
          authMode: input.authMode ?? existingBinding.authMode,
          updatedAt: new Date(),
        })
        .where(eq(teamIntegrationBindings.id, existingBinding.id))
        .returning();
      record = updated ?? existingBinding;
    }

    if (shouldSetDefault) {
      const updatedDefault = await setDefaultTeamIntegrationBinding(
        input.teamId,
        existingBinding.id
      );
      return updatedDefault ?? record;
    }

    return record;
  }

  const hasDefaultBinding = chooseDefaultBinding(activeBindings) !== null;
  const shouldSetDefault = input.isDefault ?? !hasDefaultBinding;

  if (shouldSetDefault) {
    await db
      .update(teamIntegrationBindings)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(teamIntegrationBindings.teamId, input.teamId),
          isNull(teamIntegrationBindings.revokedAt)
        )
      );
  }

  const defaultLabel =
    input.label ??
    (identity.username
      ? `${identity.provider}:${identity.username}`
      : `${identity.provider}:${identity.id.slice(0, 8)}`);

  const [created] = await db
    .insert(teamIntegrationBindings)
    .values({
      teamId: input.teamId,
      integrationIdentityId: input.integrationIdentityId,
      createdByUserId: input.createdByUserId ?? null,
      authMode: input.authMode ?? 'personal',
      label: defaultLabel,
      isDefault: shouldSetDefault,
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create team integration binding');
  }

  return created;
}

export async function setDefaultTeamIntegrationBinding(
  teamId: string,
  bindingId: string
): Promise<TeamIntegrationBindingRecord | null> {
  const target = await db.query.teamIntegrationBindings.findFirst({
    where: and(
      eq(teamIntegrationBindings.id, bindingId),
      eq(teamIntegrationBindings.teamId, teamId),
      isNull(teamIntegrationBindings.revokedAt)
    ),
  });

  if (!target) {
    return null;
  }

  await db
    .update(teamIntegrationBindings)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(eq(teamIntegrationBindings.teamId, teamId), isNull(teamIntegrationBindings.revokedAt))
    );

  const [updated] = await db
    .update(teamIntegrationBindings)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(teamIntegrationBindings.id, bindingId))
    .returning();

  return updated ?? target;
}

export async function revokeTeamIntegrationBinding(
  teamId: string,
  bindingId: string
): Promise<TeamIntegrationBindingRecord | null> {
  const target = await db.query.teamIntegrationBindings.findFirst({
    where: and(
      eq(teamIntegrationBindings.id, bindingId),
      eq(teamIntegrationBindings.teamId, teamId),
      isNull(teamIntegrationBindings.revokedAt)
    ),
  });

  if (!target) {
    return null;
  }

  const now = new Date();
  const [revoked] = await db
    .update(teamIntegrationBindings)
    .set({
      revokedAt: now,
      isDefault: false,
      updatedAt: now,
    })
    .where(eq(teamIntegrationBindings.id, bindingId))
    .returning();

  if (target.isDefault) {
    const activeBindings = await listTeamIntegrationBindings(teamId);
    const fallback = chooseDefaultBinding(activeBindings);
    if (fallback && !fallback.isDefault) {
      await setDefaultTeamIntegrationBinding(teamId, fallback.id);
    }
  }

  return revoked ?? target;
}

export async function backfillOwnerBindingForTeam(
  teamId: string
): Promise<TeamIntegrationBindingRecord | null> {
  const currentBindings = await listTeamIntegrationBindings(teamId);
  const currentDefault = chooseDefaultBinding(currentBindings);
  if (currentDefault) {
    return currentDefault;
  }

  const owner = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'owner')),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  if (!owner) {
    return null;
  }

  const identity = await db.query.integrationIdentities.findFirst({
    where: eq(integrationIdentities.userId, owner.userId),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  });

  if (!identity) {
    return null;
  }

  return createTeamIntegrationBinding({
    teamId,
    integrationIdentityId: identity.id,
    createdByUserId: owner.userId,
    authMode: 'personal',
    label: identity.username ? `${identity.provider}:${identity.username}` : 'owner-personal',
    isDefault: true,
  });
}
