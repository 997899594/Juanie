import type { GitCredential, GitProvider } from './git-credential.interface'

/**
 * GitHub App 凭证
 *
 * 使用 GitHub App 进行认证，提供组织级别的访问控制
 *
 * 优势：
 * - 更细粒度的权限控制
 * - 不依赖个人账户
 * - 支持组织级别的审计
 * - 更高的 API 速率限制
 */
export class GitHubAppCredential implements GitCredential {
  readonly type = 'github_app' as const
  readonly provider: GitProvider = 'github'

  constructor(
    public readonly id: string,
    private readonly appId: string,
    private readonly installationId: string,
    private readonly privateKey: string,
    private readonly scopes: string[] = ['repo', 'admin:org'],
    public readonly expiresAt?: Date,
  ) {}

  /**
   * 获取访问 token
   *
   * GitHub App 使用 JWT 签名获取临时 installation token
   */
  async getAccessToken(): Promise<string> {
    // 1. 生成 JWT
    const jwt = await this.generateJWT()

    // 2. 使用 JWT 获取 installation token
    const response = await fetch(
      `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to get GitHub App token: ${response.statusText}`)
    }

    const data = (await response.json()) as { token: string }
    return data.token
  }

  /**
   * 验证凭证是否有效
   */
  async validate(): Promise<boolean> {
    try {
      const token = await this.getAccessToken()

      // 验证 token 是否可以访问 API
      const response = await fetch('https://api.github.com/app', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * GitHub App token 是短期的，每次都重新生成
   */
  async refresh(): Promise<void> {
    // GitHub App token 每次调用 getAccessToken 都会生成新的
    // 无需显式刷新
  }

  /**
   * 检查凭证是否过期
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false
    }
    return new Date() > this.expiresAt
  }

  /**
   * 生成 JWT 用于认证
   *
   * GitHub App 使用 RS256 签名的 JWT
   */
  private async generateJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)

    const payload = {
      iat: now - 60, // 签发时间（提前 60 秒避免时钟偏差）
      exp: now + 600, // 过期时间（10 分钟）
      iss: this.appId, // GitHub App ID
    }

    // 使用 Web Crypto API 签名
    const encoder = new TextEncoder()
    const header = { alg: 'RS256', typ: 'JWT' }

    const headerB64 = this.base64UrlEncode(JSON.stringify(header))
    const payloadB64 = this.base64UrlEncode(JSON.stringify(payload))

    const message = `${headerB64}.${payloadB64}`

    // 导入私钥
    const key = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToArrayBuffer(this.privateKey),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign'],
    )

    // 签名
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(message))

    const signatureB64 = this.base64UrlEncode(signature)

    return `${message}.${signatureB64}`
  }

  /**
   * Base64 URL 编码
   */
  private base64UrlEncode(data: string | ArrayBuffer): string {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)

    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!)
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * 将 PEM 格式的私钥转换为 ArrayBuffer
   */
  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '')

    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    return bytes.buffer
  }

  /**
   * 获取权限范围
   */
  getScopes(): string[] {
    return this.scopes
  }

  /**
   * 检查是否有特定权限
   */
  hasPermission(permission: string): boolean {
    return this.scopes.includes(permission)
  }

  /**
   * 获取凭证元数据
   */
  getMetadata(): import('@juanie/types').CredentialMetadata {
    return {
      id: this.id,
      type: this.type,
      provider: this.provider,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: this.expiresAt,
      scopes: this.scopes,
      isValid: !this.isExpired(),
      lastValidatedAt: new Date(),
    }
  }
}
