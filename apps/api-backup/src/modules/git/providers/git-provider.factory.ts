import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { GitProvider } from '../interfaces/git-provider.interface'
import { GitHubProvider } from './github.provider'
import { GitLabProvider } from './gitlab.provider'

@Injectable()
export class GitProviderFactory {
  constructor(private readonly configService: ConfigService) {}

  create(provider: string, accessToken: string, baseUrl?: string): GitProvider {
    switch (provider.toUpperCase()) {
      case 'GITHUB':
        return new GitHubProvider(accessToken)
      case 'GITLAB':
        return new GitLabProvider(
          accessToken,
          baseUrl || this.configService.get<string>('GITLAB_BASE_URL', 'https://gitlab.com'),
        )
      case 'GITEA':
        throw new Error('Gitea provider not implemented yet')
      default:
        throw new Error(`Unsupported Git provider: ${provider}`)
    }
  }
}
