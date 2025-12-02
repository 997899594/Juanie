import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

export interface GitHubOAuthTokenResponse {
  access_token: string
  token_type: string
  scope: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
}

export interface GitHubUserInfo {
  id: number
  login: string
  email: string | null
  avatar_url: string
  name: string | null
}

@Injectable()
export class GitHubOAuthService {
  private readonly logger = new Logger(GitHubOAuthService.name)
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GITHUB_CLIENT_ID') || ''
    this.clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET') || ''
    this.redirectUri = this.configService.get<string>('GITHUB_REDIRECT_URI') || ''
  }

  /**
   * 生成 OAuth 授权 URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:user user:email repo admin:org',
      state,
    })

    return `https://github.com/login/oauth/authorize?${params.toString()}`
  }

  /**
   * 使用授权码交换 Access Token
   */
  async exchangeCodeForToken(code: string): Promise<GitHubOAuthTokenResponse> {
    this.logger.log('Exchanging GitHub authorization code for access token')

    try {
      const response = await axios.post<GitHubOAuthTokenResponse>(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      this.logger.log('Successfully exchanged code for GitHub access token')
      return response.data
    } catch (error) {
      this.logger.error('Failed to exchange code for GitHub access token', error)
      throw new Error('Failed to authenticate with GitHub')
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(accessToken: string): Promise<GitHubUserInfo> {
    this.logger.log('Fetching GitHub user info')

    try {
      const response = await axios.get<GitHubUserInfo>('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      })

      // 如果 email 为空，尝试获取主邮箱
      if (!response.data.email) {
        const emailsResponse = await axios.get<Array<{ email: string; primary: boolean }>>(
          'https://api.github.com/user/emails',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github+json',
            },
          },
        )

        const primaryEmail = emailsResponse.data.find((e) => e.primary)
        if (primaryEmail) {
          response.data.email = primaryEmail.email
        }
      }

      this.logger.log(`Fetched GitHub user info for ${response.data.login}`)
      return response.data
    } catch (error) {
      this.logger.error('Failed to fetch GitHub user info', error)
      throw new Error('Failed to fetch GitHub user information')
    }
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(refreshToken: string): Promise<GitHubOAuthTokenResponse> {
    this.logger.log('Refreshing GitHub access token')

    try {
      const response = await axios.post<GitHubOAuthTokenResponse>(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      this.logger.log('Successfully refreshed GitHub access token')
      return response.data
    } catch (error) {
      this.logger.error('Failed to refresh GitHub access token', error)
      throw new Error('Failed to refresh GitHub access token')
    }
  }

  /**
   * 撤销 Access Token
   */
  async revokeAccessToken(accessToken: string): Promise<void> {
    this.logger.log('Revoking GitHub access token')

    try {
      await axios.delete(`https://api.github.com/applications/${this.clientId}/token`, {
        auth: {
          username: this.clientId,
          password: this.clientSecret,
        },
        data: {
          access_token: accessToken,
        },
      })

      this.logger.log('Successfully revoked GitHub access token')
    } catch (error) {
      this.logger.error('Failed to revoke GitHub access token', error)
      throw new Error('Failed to revoke GitHub access token')
    }
  }
}
