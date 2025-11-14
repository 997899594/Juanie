import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * OAuth账户管理组合式函数
 */
export function useOAuth() {
  const toast = useToast()

  const accounts = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * 获取用户的所有OAuth账户
   */
  const listAccounts = async () => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.users.oauthAccounts.list.query()
      accounts.value = result ?? []
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('获取OAuth账户失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 检查是否已连接指定提供商
   */
  const hasProvider = async (provider: 'github' | 'gitlab') => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.users.oauthAccounts.hasProvider.query({ provider })
      return result.hasProvider
    } catch (e) {
      error.value = e as Error
      toast.error('检查OAuth状态失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 断开OAuth连接
   */
  const disconnect = async (provider: 'github' | 'gitlab') => {
    isLoading.value = true
    error.value = null
    try {
      await trpc.users.oauthAccounts.disconnect.mutate({ provider })

      // 更新本地账户列表
      accounts.value = accounts.value.filter((acc) => acc.provider !== provider)

      toast.success(
        '断开连接成功',
        `已断开与 ${provider === 'github' ? 'GitHub' : 'GitLab'} 的连接`,
      )
    } catch (e) {
      error.value = e as Error
      toast.error('断开连接失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取OAuth授权URL（用于连接新账户）
   */
  const getAuthUrl = (provider: 'github' | 'gitlab', redirectUri?: string) => {
    const baseUrl = window.location.origin
    const redirect = redirectUri || `${baseUrl}/auth/callback`

    if (provider === 'github') {
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
      return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=repo,user`
    } else {
      const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID
      const gitlabUrl = import.meta.env.VITE_GITLAB_BASE_URL || 'https://gitlab.com'
      return `${gitlabUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=api,read_user,read_repository,write_repository`
    }
  }

  /**
   * 连接OAuth账户（跳转到授权页面）
   */
  const connect = (provider: 'github' | 'gitlab') => {
    const authUrl = getAuthUrl(provider)
    window.location.href = authUrl
  }

  return {
    accounts: computed(() => accounts.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    listAccounts,
    hasProvider,
    disconnect,
    connect,
    getAuthUrl,
  }
}
