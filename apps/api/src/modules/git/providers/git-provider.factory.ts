import { Injectable } from '@nestjs/common'
import type { GitProvider } from '../interfaces/git-provider.interface'
import { GitHubProvider } from './github.provider'
import { GitLabProvider } from './gitlab.provider'

@Injectable()
export class GitProviderFactory {
  create(provider: string, accessToken: string, baseUrl?: string): GitProvider {
    switch (provider.toUpperCase()) {
      case 'GITHUB':
        return new GitHubProvider(accessToken)
      case 'GITLAB':
        return new GitLabProvider(accessToken, baseUrl)
      case 'GITEA':
        // TODO: 实现 Gitea 提供者
        throw new Error('Gitea provider not implemented yet')
      default:
        throw new Error(`Unsupported Git provider: ${provider}`)
    }
  }

  getSupportedProviders(): string[] {
    return ['GITHUB', 'GITLAB']
  }
}
