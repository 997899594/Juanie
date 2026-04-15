import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type IntegrationAuthMode,
  integrationCapabilitySnapshots,
  integrationGrants,
  integrationIdentities,
} from '@/lib/db/schema';
import { integrationErrors, toIntegrationError } from '@/lib/integrations/domain/errors';
import type { Capability } from '@/lib/integrations/domain/models';

export type IntegrationSession = {
  integrationId: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  serverUrl: string | null;
  teamId: string;
  grantId: string;
  accessToken: string;
  capabilities: Capability[];
  bindingId?: string;
  bindingAuthMode?: IntegrationAuthMode;
  bindingLabel?: string | null;
};

export const assertCapabilities = (
  granted: Capability[] | string[],
  required: Capability[] | string[]
): void => {
  const grantedSet = new Set(granted);

  for (const capability of required) {
    if (!grantedSet.has(capability)) {
      throw toIntegrationError(integrationErrors.missingCapability(capability));
    }
  }
};

export const createIntegrationSession = async ({
  integrationId,
  teamId,
  requiredCapabilities,
  binding,
}: {
  integrationId: string;
  teamId: string;
  requiredCapabilities: Capability[];
  binding?: {
    id: string;
    authMode: IntegrationAuthMode;
    label?: string | null;
  };
}): Promise<IntegrationSession> => {
  const identity = await db.query.integrationIdentities.findFirst({
    where: eq(integrationIdentities.id, integrationId),
  });

  if (!identity) {
    throw toIntegrationError(integrationErrors.notBound());
  }

  if (identity.provider === 'gitlab-self-hosted' && !identity.serverUrl) {
    throw new Error('GitLab self-hosted integration is missing serverUrl');
  }

  const grant = await db.query.integrationGrants.findFirst({
    where: and(
      eq(integrationGrants.integrationIdentityId, identity.id),
      isNull(integrationGrants.revokedAt)
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (!grant) {
    throw toIntegrationError(integrationErrors.grantRevoked());
  }

  if (grant.expiresAt && grant.expiresAt < new Date()) {
    throw toIntegrationError(integrationErrors.grantExpired());
  }

  const snapshotRows = await db.query.integrationCapabilitySnapshots.findMany({
    where: eq(integrationCapabilitySnapshots.integrationGrantId, grant.id),
  });

  const capabilities = snapshotRows.map((row) => row.capability) as Capability[];
  assertCapabilities(capabilities, requiredCapabilities);

  return {
    integrationId,
    provider: identity.provider,
    serverUrl: identity.serverUrl,
    teamId,
    grantId: grant.id,
    accessToken: grant.accessToken,
    capabilities,
    bindingId: binding?.id,
    bindingAuthMode: binding?.authMode,
    bindingLabel: binding?.label ?? null,
  };
};
