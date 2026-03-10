import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type GitProviderType,
  integrationCapabilitySnapshots,
  integrationGrants,
  integrationIdentities,
} from '@/lib/db/schema';
import {
  resolveGitHubCapabilities,
  resolveGitLabCapabilities,
} from '@/lib/integrations/domain/capability';
import type { Capability } from '@/lib/integrations/domain/models';

type UpsertGrantFromOAuthInput = {
  userId: string;
  provider: GitProviderType;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopeRaw?: string | null;
};

const splitScopes = (scopeRaw?: string | null): string[] => {
  if (!scopeRaw) {
    return [];
  }

  return scopeRaw
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
};

const resolveCapabilities = (provider: GitProviderType, scopes: string[]): Capability[] => {
  if (provider === 'github') {
    return resolveGitHubCapabilities(scopes);
  }

  return resolveGitLabCapabilities(scopes);
};

export const upsertGrantFromOAuth = async ({
  userId,
  provider,
  accessToken,
  refreshToken,
  expiresAt,
  scopeRaw,
}: UpsertGrantFromOAuthInput) => {
  let identity = await db.query.integrationIdentities.findFirst({
    where: and(
      eq(integrationIdentities.userId, userId),
      eq(integrationIdentities.provider, provider)
    ),
  });

  if (!identity) {
    const [created] = await db
      .insert(integrationIdentities)
      .values({
        userId,
        provider,
      })
      .returning();

    identity = created;
  }

  await db
    .update(integrationGrants)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationGrants.integrationIdentityId, identity.id),
        isNull(integrationGrants.revokedAt)
      )
    );

  const [grant] = await db
    .insert(integrationGrants)
    .values({
      integrationIdentityId: identity.id,
      accessToken,
      refreshToken: refreshToken ?? null,
      scopeRaw: scopeRaw ?? null,
      expiresAt: expiresAt ?? null,
    })
    .returning();

  const capabilities = resolveCapabilities(provider, splitScopes(scopeRaw));

  if (capabilities.length > 0) {
    await db.insert(integrationCapabilitySnapshots).values(
      capabilities.map((capability) => ({
        integrationGrantId: grant.id,
        capability,
      }))
    );
  }

  return { identity, grant, capabilities };
};

export const revokeActiveGrants = async (userId: string) => {
  const identities = await db.query.integrationIdentities.findMany({
    where: eq(integrationIdentities.userId, userId),
  });

  if (identities.length === 0) {
    return { ok: true as const, count: 0 };
  }

  const identityIds = identities.map((identity) => identity.id);

  const revoked = await db
    .update(integrationGrants)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(integrationGrants.integrationIdentityId, identityIds),
        isNull(integrationGrants.revokedAt)
      )
    )
    .returning({ id: integrationGrants.id });

  return {
    ok: true as const,
    count: revoked.length,
  };
};
