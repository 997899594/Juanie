import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { integrationIdentities, teamMembers } from '@/lib/db/schema';
import type {
  GitRepository,
  PushOptions,
  RegistryWebhookOptions,
  WebhookOptions,
} from '@/lib/git';
import { gitlabAdapter } from '@/lib/integrations/adapters/gitlab-adapter';
import { githubAdapter } from '@/lib/integrations/adapters/github-adapter';
import {
  integrationErrors,
  type IntegrationError,
  type IntegrationErrorCode,
} from '@/lib/integrations/domain/errors';
import type { Capability } from '@/lib/integrations/domain/models';
import { createIntegrationSession, type IntegrationSession } from '@/lib/integrations/service/session-service';

type ProviderErrorInput = {
  status?: number;
  message?: string;
};

const isGitHubProvider = (provider: string) => provider === 'github';

const resolveAdapter = (provider: 'github' | 'gitlab') =>
  isGitHubProvider(provider) ? githubAdapter : gitlabAdapter;

export const mapProviderError = (error: ProviderErrorInput): IntegrationError => {
  if (error.status === 404) {
    return integrationErrors.providerResourceNotFound();
  }

  if (error.status === 401 || error.status === 403) {
    return integrationErrors.providerAccessDenied();
  }

  return {
    code: 'PROVIDER_ACCESS_DENIED',
    message: error.message || 'Provider request failed',
  };
};

export const normalizeApiError = (
  error: Partial<IntegrationError> & { code?: IntegrationErrorCode | string; capability?: string }
) => {
  if (error.code === 'MISSING_CAPABILITY' && error.capability) {
    return {
      error: {
        code: `MISSING_CAPABILITY(${error.capability})`,
        message: error.message ?? `Missing capability: ${error.capability}`,
      },
    };
  }

  return {
    error: {
      code: error.code ?? 'UNKNOWN_ERROR',
      message: error.message ?? 'Unknown integration error',
    },
  };
};

export const getTeamIntegrationSession = async ({
  integrationId,
  teamId,
  requiredCapabilities,
}: {
  integrationId: string;
  teamId: string;
  requiredCapabilities: Capability[];
}): Promise<IntegrationSession> => {
  const owner = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'owner')),
  });

  if (!owner) {
    throw new Error(integrationErrors.notBound().message);
  }

  const identity = await db.query.integrationIdentities.findFirst({
    where: and(
      eq(integrationIdentities.id, integrationId),
      eq(integrationIdentities.userId, owner.userId)
    ),
  });

  if (!identity) {
    throw new Error(integrationErrors.notBound().message);
  }

  return createIntegrationSession({
    integrationId: identity.id,
    teamId,
    requiredCapabilities,
  });
};

export const gateway = {
  async listRepositories(
    session: IntegrationSession,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const adapter = resolveAdapter(session.provider);
    return adapter.listRepositories(session, options);
  },

  async getRepository(session: IntegrationSession, fullName: string): Promise<GitRepository | null> {
    const adapter = resolveAdapter(session.provider);
    return adapter.getRepository(session, fullName);
  },

  async createRepository(session: IntegrationSession, options: CreateRepoOptions): Promise<GitRepository> {
    const adapter = resolveAdapter(session.provider);
    return adapter.createRepository(session, options);
  },

  async createWebhook(session: IntegrationSession, options: WebhookOptions): Promise<{ id: string }> {
    const adapter = resolveAdapter(session.provider);
    return adapter.createWebhook(session, options);
  },

  async setupRegistryWebhook(
    session: IntegrationSession,
    options: RegistryWebhookOptions
  ): Promise<{ id: string }> {
    const adapter = resolveAdapter(session.provider);
    return adapter.setupRegistryWebhook(session, options);
  },

  async listRootFiles(session: IntegrationSession, repoFullName: string, branch?: string): Promise<string[]> {
    const adapter = resolveAdapter(session.provider);
    return adapter.listRootFiles(session, repoFullName, branch);
  },

  async getFileContent(
    session: IntegrationSession,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<string | null> {
    const adapter = resolveAdapter(session.provider);
    return adapter.getFileContent(session, repoFullName, path, branch);
  },

  async listDirectory(
    session: IntegrationSession,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const adapter = resolveAdapter(session.provider);
    return adapter.listDirectory(session, repoFullName, path, branch);
  },
};
