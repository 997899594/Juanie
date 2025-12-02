import { ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * Git 同步管理 Composable
 * 提供 Git 账号关联和权限同步功能
 */
export function useGitSync() {
  const toast = useToast()

  const loading = ref(false)
  const accounts = ref<any[]>([])
  const syncLogs = ref<any[]>([])

  /**
   * 获取用户的 Git 账号状态
   */
  async function getGitAccountStatus(provider?: 'github' | 'gitlab') {
    loading.value = true
    try {
      const result = await trpc.gitSync.getGitAccountStatus.query({
        provider,
      })
      accounts.value = result.accounts
      return result.accounts
    } catch (error: any) {
      toast.error('获取账号状态失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取 OAuth 授权 URL
   */
  async function getOAuthUrl(provider: 'github' | 'gitlab', redirectUri?: string) {
    loading.value = true
    try {
      const result = await trpc.gitSync.getOAuthUrl.query({
        provider,
        redirectUri,
      })
      return result.authUrl
    } catch (error: any) {
      toast.error('获取授权链接失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 关联 Git 账号
   */
  async function linkGitAccount(provider: 'github' | 'gitlab', code: string, state?: string) {
    loading.value = true
    try {
      const result = await trpc.gitSync.linkGitAccount.mutate({
        provider,
        code,
        state,
      })

      toast.success('关联成功', `已成功关联 ${provider === 'github' ? 'GitHub' : 'GitLab'} 账号`)

      return result.account
    } catch (error: any) {
      toast.error('关联失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 取消关联 Git 账号
   */
  async function unlinkGitAccount(accountId: string) {
    loading.value = true
    try {
      await trpc.gitSync.unlinkGitAccount.mutate({ accountId })

      toast.success('取消关联成功', 'Git 账号已取消关联')

      // 从列表中移除
      accounts.value = accounts.value.filter((acc) => acc.id !== accountId)
    } catch (error: any) {
      toast.error('取消关联失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目的同步日志
   */
  async function getProjectSyncLogs(
    projectId: string,
    limit = 20,
    status?: 'pending' | 'success' | 'failed',
  ) {
    loading.value = true
    try {
      const result = await trpc.gitSync.getProjectSyncLogs.query({
        projectId,
        limit,
        status,
      })
      syncLogs.value = result.logs
      return result.logs
    } catch (error: any) {
      toast.error('获取同步日志失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 重试失败的同步任务
   */
  async function retrySyncTask(syncLogId: string) {
    loading.value = true
    try {
      await trpc.gitSync.retrySyncTask.mutate({ syncLogId })

      toast.success('重试已触发', '正在重新同步...')
    } catch (error: any) {
      toast.error('重试失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 手动触发项目成员同步
   */
  async function syncProjectMembers(projectId: string) {
    loading.value = true
    try {
      await trpc.gitSync.syncProjectMembers.mutate({ projectId })

      toast.success('同步已触发', '正在同步项目成员权限...')
    } catch (error: any) {
      toast.error('同步失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取失败的同步任务
   */
  async function getFailedSyncs(projectId?: string) {
    loading.value = true
    try {
      const result = await trpc.gitSync.getFailedSyncs.query({
        projectId,
      })
      return result.syncs
    } catch (error: any) {
      toast.error('获取失败任务失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    // 状态
    loading,
    accounts,
    syncLogs,

    // Git 账号管理
    getGitAccountStatus,
    getOAuthUrl,
    linkGitAccount,
    unlinkGitAccount,

    // 同步管理
    getProjectSyncLogs,
    retrySyncTask,
    syncProjectMembers,
    getFailedSyncs,
  }
}
