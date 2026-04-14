import {
  type CreateBranchOptions,
  type CreateRepoOptions,
  type CreateReviewRequestOptions,
  createGitProvider,
  type GitRepository,
  type GitReviewRequest,
  type PushOptions,
  type TriggerReleaseBuildOptions,
} from '@/lib/git';
import type { IntegrationSession } from '@/lib/integrations/service/session-service';

const createProvider = (provider: 'gitlab' | 'gitlab-self-hosted') =>
  createGitProvider({
    type: provider,
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });

const resolveGitLabProvider = (session: IntegrationSession): 'gitlab' | 'gitlab-self-hosted' =>
  session.provider === 'gitlab-self-hosted' ? 'gitlab-self-hosted' : 'gitlab';

export const gitlabAdapter = {
  async listRepositories(
    session: IntegrationSession,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.getRepositories(session.accessToken, options);
  },

  async getRepository(
    session: IntegrationSession,
    fullName: string
  ): Promise<GitRepository | null> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.getRepository(session.accessToken, fullName);
  },

  async getReviewRequest(
    session: IntegrationSession,
    repoFullName: string,
    number: number
  ): Promise<GitReviewRequest | null> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.getReviewRequest(session.accessToken, repoFullName, number);
  },

  async resolveRefToCommitSha(
    session: IntegrationSession,
    repoFullName: string,
    ref: string
  ): Promise<string | null> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.resolveRefToCommitSha(session.accessToken, repoFullName, ref);
  },

  async triggerReleaseBuild(
    session: IntegrationSession,
    options: TriggerReleaseBuildOptions
  ): Promise<void> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.triggerReleaseBuild(session.accessToken, options);
  },

  async createRepository(
    session: IntegrationSession,
    options: CreateRepoOptions
  ): Promise<GitRepository> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.createRepository(session.accessToken, options);
  },

  async createBranch(session: IntegrationSession, options: CreateBranchOptions): Promise<void> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.createBranch(session.accessToken, options);
  },

  async createReviewRequest(
    session: IntegrationSession,
    options: CreateReviewRequestOptions
  ): Promise<GitReviewRequest> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.createReviewRequest(session.accessToken, options);
  },

  async pushFiles(session: IntegrationSession, options: PushOptions): Promise<void> {
    const provider = createProvider(resolveGitLabProvider(session));
    await provider.pushFiles(session.accessToken, options);
  },

  async listRootFiles(
    session: IntegrationSession,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.listRootFiles(session.accessToken, repoFullName, branch);
  },

  async getFileContent(
    session: IntegrationSession,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<string | null> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.getFileContent(session.accessToken, repoFullName, path, branch);
  },

  async listDirectory(
    session: IntegrationSession,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const provider = createProvider(resolveGitLabProvider(session));
    return provider.listDirectory(session.accessToken, repoFullName, path, branch);
  },
};
