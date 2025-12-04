import { Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

export interface GitLabOAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  created_at: number
  scope: string
}

export interface GitLabUserInfo {
  id: number
  username: string
  email: string
  name: string
  avatar_url: string
  web_url: string
}

@Injectable()
export class GitLabOAuthService {
  private readonly logger = new Logger(GitLabOAuthService.name)
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private readonly gitlabUrl: string

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GITLAB_CLIENT_ID') || ''
    this.clientSecret = this.configService.get<string>('GITLAB_CLIENT_SECRET') || ''
    this.redirectUri = this.configService.get<string>('GITLAB_REDIRECT_URI') || ''
    this.gitlabUrl = this.configService.get<string>('GITLAB_URL') || 'https://gitlab.com'
  }

  /**
   * 生成 OAuth 授权 URL
   */
  getAuthorizationUrl(state: string, serverUrl?: string): string {
    const baseUrl = serverUrl || this.gitlabUrl
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'read_user read_api write_repository api',
      state,
    })

    return `${baseUrl}/oauth/authorize?${params.toString()}`
  }

  /**
   * 使用授权码交换 Access Token
   */
  async exchangeCodeForToken(code: string, serverUrl?: string): Promise<GitLabOAuthTokenResponse> {
    const baseUrl = serverUrl || this.gitlabUrl
    this.logger.log(`Exchanging GitLab authorization code for access token (${baseUrl})`)

    try {
      const response = await axios.post<GitLabOAuthTokenResponse>(
        `${baseUrl}/oauth/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      this.logger.log('Successfully exchanged code for GitLab access token')
      return response.data
    } catch (error) {
      this.logger.error('Failed to exchange code for GitLab access token', error)
      throw new Error('Failed to authenticate with GitLab')
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(accessToken: string, serverUrl?: string): Promise<GitLabUserInfo> {
    const baseUrl = serverUrl || this.gitlabUrl
    this.logger.log(`Fetching GitLab user info (${baseUrl})`)

    try {
      const response = await axios.get<GitLabUserInfo>(`${baseUrl}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      this.logger.log(`Fetched GitLab user info for ${response.data.username}`)
      return response.data
    } catch (error) {
      this.logger.error('Failed to fetch GitLab user info', error)
      throw new Error('Failed to fetch GitLab user information')
    }
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(
    refreshToken: string,
    serverUrl?: string,
  ): Promise<GitLabOAuthTokenResponse> {
    const baseUrl = serverUrl || this.gitlabUrl
    this.logger.log(`Refreshing GitLab access token (${baseUrl})`)

    try {
      const response = await axios.post<GitLabOAuthTokenResponse>(
        `${baseUrl}/oauth/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      this.logger.log('Successfully refreshed GitLab access token')
      return response.data
    } catch (error) {
      this.logger.error('Failed to refresh GitLab access token', error)
      throw new Error('Failed to refresh GitLab access token')
    }
  }

  /**
   * 撤销 Access Token
   */
  async revokeAccessToken(accessToken: string, serverUrl?: string): Promise<void> {
    const baseUrl = serverUrl || this.gitlabUrl
    this.logger.log(`Revoking GitLab access token (${baseUrl})`)

    try {
      await axios.post(
        `${baseUrl}/oauth/revoke`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          token: accessToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      this.logger.log('Successfully revoked GitLab access token')
    } catch (error) {
      this.logger.error('Failed to revoke GitLab access token', error)
      throw new Error('Failed to revoke GitLab access token')
    }
  }
}
