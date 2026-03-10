import {
  type CreateRepoOptions,
  createGitProvider,
  type GitRepository,
  type PushOptions,
  type RegistryWebhookOptions,
  type WebhookOptions,
} from '@/lib/git';
import type { IntegrationSession } from '@/lib/integrations/service/session-service';

const createProvider = (provider: 'gitlab' | 'gitlab-self-hosted') =>
  createGitProvider({
    type: provider,
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });

export const gitlabAdapter = {
  async listRepositories(
    session: IntegrationSession,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const provider = createProvider('gitlab');
    return provider.getRepositories(session.accessToken, options);
  },

  async getRepository(
    session: IntegrationSession,
    fullName: string
  ): Promise<GitRepository | null> {
    const provider = createProvider('gitlab');
    return provider.getRepository(session.accessToken, fullName);
  },

  async createRepository(
    session: IntegrationSession,
    options: CreateRepoOptions
  ): Promise<GitRepository> {
    const provider = createProvider('gitlab');
    return provider.createRepository(session.accessToken, options);
  },

  async pushFiles(session: IntegrationSession, options: PushOptions): Promise<void> {
    const provider = createProvider('gitlab');
    await provider.pushFiles(session.accessToken, options);
  },

  async createWebhook(
    session: IntegrationSession,
    options: WebhookOptions
  ): Promise<{ id: string }> {
    const provider = createProvider('gitlab');
    return provider.createWebhook(session.accessToken, options);
  },

  async setupRegistryWebhook(
    session: IntegrationSession,
    options: RegistryWebhookOptions
  ): Promise<{ id: string }> {
    const provider = createProvider('gitlab');
    return provider.setupRegistryWebhook(session.accessToken, options);
  },

  async listRootFiles(
    session: IntegrationSession,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
    const provider = createProvider('gitlab');
    return provider.listRootFiles(session.accessToken, repoFullName, branch);
  },

  async getFileContent(
    session: IntegrationSession,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<string | null> {
    const provider = createProvider('gitlab');
    return provider.getFileContent(session.accessToken, repoFullName, path, branch);
  },

  async listDirectory(
    session: IntegrationSession,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const provider = createProvider('gitlab');
    return provider.listDirectory(session.accessToken, repoFullName, path, branch);
  },
};
