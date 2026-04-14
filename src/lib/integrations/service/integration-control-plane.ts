import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';
import type {
  CreateBranchOptions,
  CreateRepoOptions,
  CreateReviewRequestOptions,
  GitRepository,
  GitReviewRequest,
  PushOptions,
  TriggerReleaseBuildOptions,
} from '@/lib/git';
import { githubAdapter } from '@/lib/integrations/adapters/github-adapter';
import { gitlabAdapter } from '@/lib/integrations/adapters/gitlab-adapter';
import {
  type IntegrationError,
  type IntegrationErrorCode,
  integrationErrors,
  toIntegrationError,
} from '@/lib/integrations/domain/errors';
import type { Capability } from '@/lib/integrations/domain/models';
import {
  createIntegrationSession,
  type IntegrationSession,
} from '@/lib/integrations/service/session-service';
import {
  backfillOwnerBindingForTeam,
  chooseDefaultBinding,
  listTeamIntegrationBindings,
} from '@/lib/integrations/service/team-binding-service';

export type { IntegrationSession };

type ProviderErrorInput = {
  status?: number;
  message?: string;
};

const isGitHubProvider = (provider: string) => provider === 'github';

const resolveAdapter = (provider: 'github' | 'gitlab' | 'gitlab-self-hosted') =>
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

export const statusByCode = (code?: string) => {
  if (!code) return 500;
  if (code.startsWith('MISSING_CAPABILITY')) return 403;

  switch (code) {
    case 'INTEGRATION_NOT_BOUND':
      return 404;
    case 'TEAM_ACCESS_DENIED':
    case 'GRANT_EXPIRED':
    case 'GRANT_REVOKED':
    case 'PROVIDER_ACCESS_DENIED':
      return 403;
    case 'PROVIDER_RESOURCE_NOT_FOUND':
      return 404;
    default:
      return 500;
  }
};

const resolveBoundIdentity = async (input: {
  teamId: string;
  integrationId?: string;
  bindingId?: string;
}) => {
  const pickCandidate = async () => {
    const bindings = await listTeamIntegrationBindings(input.teamId);
    if (bindings.length === 0) {
      return null;
    }

    if (input.bindingId) {
      return bindings.find((binding) => binding.id === input.bindingId) ?? null;
    }

    if (input.integrationId) {
      const scoped = bindings.filter(
        (binding) => binding.integrationIdentityId === input.integrationId
      );
      return chooseDefaultBinding(scoped);
    }

    return chooseDefaultBinding(bindings);
  };

  let candidate = await pickCandidate();
  if (!candidate) {
    await backfillOwnerBindingForTeam(input.teamId);
    candidate = await pickCandidate();
  }

  if (!candidate) {
    return null;
  }

  if (input.bindingId && candidate.id !== input.bindingId) {
    return null;
  }

  if (input.integrationId && candidate.integrationIdentityId !== input.integrationId) {
    return null;
  }

  return candidate;
};

export const getTeamIntegrationSession = async ({
  integrationId,
  bindingId,
  teamId,
  actingUserId,
  requiredCapabilities,
}: {
  integrationId?: string;
  bindingId?: string;
  teamId: string;
  actingUserId?: string | null;
  requiredCapabilities: Capability[];
}): Promise<IntegrationSession> => {
  if (actingUserId) {
    const actingMember = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, actingUserId)),
    });

    if (!actingMember) {
      throw toIntegrationError(integrationErrors.teamAccessDenied());
    }
  }

  const binding = await resolveBoundIdentity({
    teamId,
    integrationId: integrationId || undefined,
    bindingId: bindingId || undefined,
  });

  if (!binding) {
    throw toIntegrationError(integrationErrors.notBound());
  }

  return createIntegrationSession({
    integrationId: binding.integrationIdentityId,
    teamId,
    requiredCapabilities,
    binding: {
      id: binding.id,
      authMode: binding.authMode,
      label: binding.label,
    },
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

  async getRepository(
    session: IntegrationSession,
    fullName: string
  ): Promise<GitRepository | null> {
    const adapter = resolveAdapter(session.provider);
    return adapter.getRepository(session, fullName);
  },

  async getReviewRequest(
    session: IntegrationSession,
    repoFullName: string,
    number: number
  ): Promise<GitReviewRequest | null> {
    const adapter = resolveAdapter(session.provider);
    return adapter.getReviewRequest(session, repoFullName, number);
  },

  async resolveRefToCommitSha(
    session: IntegrationSession,
    repoFullName: string,
    ref: string
  ): Promise<string | null> {
    const adapter = resolveAdapter(session.provider);
    return adapter.resolveRefToCommitSha(session, repoFullName, ref);
  },

  async triggerReleaseBuild(
    session: IntegrationSession,
    options: TriggerReleaseBuildOptions
  ): Promise<void> {
    const adapter = resolveAdapter(session.provider);
    return adapter.triggerReleaseBuild(session, options);
  },

  async createRepository(
    session: IntegrationSession,
    options: CreateRepoOptions
  ): Promise<GitRepository> {
    const adapter = resolveAdapter(session.provider);
    return adapter.createRepository(session, options);
  },

  async createBranch(session: IntegrationSession, options: CreateBranchOptions): Promise<void> {
    const adapter = resolveAdapter(session.provider);
    return adapter.createBranch(session, options);
  },

  async createReviewRequest(
    session: IntegrationSession,
    options: CreateReviewRequestOptions
  ): Promise<GitReviewRequest> {
    const adapter = resolveAdapter(session.provider);
    return adapter.createReviewRequest(session, options);
  },

  async listRootFiles(
    session: IntegrationSession,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
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

  async pushFiles(session: IntegrationSession, options: PushOptions): Promise<void> {
    const adapter = resolveAdapter(session.provider);
    return adapter.pushFiles(session, options);
  },
};
