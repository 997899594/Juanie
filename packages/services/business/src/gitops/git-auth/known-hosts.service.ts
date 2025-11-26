import { execSync } from 'node:child_process'
import { Injectable, Logger } from '@nestjs/common'

/**
 * SSH Known Hosts 管理服务
 *
 * 职责：
 * - 获取 Git 提供商的 SSH 主机密钥
 * - 缓存 known_hosts 内容
 * - 支持多个 Git 提供商
 */
@Injectable()
export class KnownHostsService {
  private readonly logger = new Logger(KnownHostsService.name)
  private cache = new Map<string, { content: string; timestamp: number }>()
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 小时

  /**
   * 获取 Git 提供商的 known_hosts
   */
  async getKnownHosts(provider: 'github' | 'gitlab', customHost?: string): Promise<string> {
    const host = customHost || this.getDefaultHost(provider)
    const cacheKey = host

    // 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Using cached known_hosts for ${host}`)
      return cached.content
    }

    // 获取新的 known_hosts
    try {
      const knownHosts = await this.fetchKnownHosts(host)

      // 缓存结果
      this.cache.set(cacheKey, {
        content: knownHosts,
        timestamp: Date.now(),
      })

      this.logger.log(`Fetched known_hosts for ${host}`)
      return knownHosts
    } catch (error) {
      this.logger.error(`Failed to fetch known_hosts for ${host}:`, error)

      // 如果获取失败，使用备用的硬编码版本
      return this.getFallbackKnownHosts(provider)
    }
  }

  /**
   * 使用 ssh-keyscan 获取主机密钥
   */
  private async fetchKnownHosts(host: string): Promise<string> {
    try {
      // 使用 ssh-keyscan 获取所有类型的密钥
      const result = execSync(`ssh-keyscan -t rsa,ecdsa,ed25519 ${host} 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 10000, // 10 秒超时
      })

      if (!result || result.trim().length === 0) {
        throw new Error('ssh-keyscan returned empty result')
      }

      return result.trim()
    } catch (error) {
      throw new Error(
        `ssh-keyscan failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * 获取默认主机名
   */
  private getDefaultHost(provider: 'github' | 'gitlab'): string {
    switch (provider) {
      case 'github':
        return 'github.com'
      case 'gitlab':
        return 'gitlab.com'
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  /**
   * 获取备用的 known_hosts（从官方文档）
   *
   * 这些是官方提供的公钥指纹，作为 ssh-keyscan 失败时的备用方案
   */
  private getFallbackKnownHosts(provider: 'github' | 'gitlab'): string {
    switch (provider) {
      case 'github':
        // 来源: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
        return `github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=`

      case 'gitlab':
        // 来源: https://docs.gitlab.com/ee/user/gitlab_com/index.html#ssh-host-keys-fingerprints
        return `gitlab.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt6CM6tdG4SLp1Btn/nOeHHE5UOzRdf
gitlab.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCsj2bNKTBSpIYDEGk9KxsGh3mySTRgMtXL583qmBpzeQ+jqCMRgBqB98u3z++J1sKlXHWfM9dyhSevkMwSbhoR8XIq/U0tCNyokEi/ueaBMCvbcTHhO7FcwzY92WK4Yt0aGROY5qX2UKSeOvuP4D6TPqKF1onrSzH9bx9XUf2lEdWT/ia1NEKjunUqu1xOB/StKDHMoX4/OKyIzuS0q/T1zOATthvasJFoPrAjkohTyaDUz2LN5JoH839hViyEG82yB+MjcFV5MU3N1l1QL3cVUCh93xSaua1N85qivl+siMkPGbO5xR/En4iEY6K2XPASUEMaieWVNTRCtJ4S8H+9
gitlab.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBFSMqzJeV9rUzU4kWitGjeR4PWSa29SPqJ1fVkhtj3Hw9xjLVXVYrU9QlYWrOLXBpQ6KWjbjTDTdDkoohFzgbEY=`

      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  /**
   * 从 URL 提取主机名
   */
  extractHostFromUrl(url: string): string {
    try {
      // 处理 SSH URL: ssh://git@github.com/owner/repo.git
      if (url.startsWith('ssh://')) {
        const match = url.match(/ssh:\/\/(?:.*@)?([^/:]+)/)
        return match?.[1] || ''
      }

      // 处理 HTTPS URL: https://github.com/owner/repo.git
      if (url.startsWith('https://') || url.startsWith('http://')) {
        const urlObj = new URL(url)
        return urlObj.hostname
      }

      // 处理传统 SSH URL: git@github.com:owner/repo.git
      const match = url.match(/(?:.*@)?([^:]+):/)
      return match?.[1] || ''
    } catch (error) {
      this.logger.error(`Failed to extract host from URL: ${url}`, error)
      return ''
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
    this.logger.log('Known hosts cache cleared')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; entries: Array<{ host: string; age: number }> } {
    const now = Date.now()
    const entries = Array.from(this.cache.entries()).map(([host, data]) => ({
      host,
      age: Math.floor((now - data.timestamp) / 1000), // 秒
    }))

    return {
      size: this.cache.size,
      entries,
    }
  }
}
