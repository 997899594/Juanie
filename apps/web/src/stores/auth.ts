import type { inferRouterOutputs } from '@trpc/server'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { type AppRouter, isTRPCClientError, trpc } from '@/lib/trpc'

// 使用 tRPC 推断的类型
type RouterOutput = inferRouterOutputs<AppRouter>
type ValidateSessionOutput = RouterOutput['auth']['validateSession']
type User = ValidateSessionOutput['user']

export const useAuthStore = defineStore('auth', () => {
  const toast = useToast()

  // 状态
  const user = ref<User | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  // 计算属性：仅根据用户是否存在判断认证状态
  const isAuthenticated = computed(() => !!user.value)

  // 初始化认证状态（Cookie-only：直接请求受保护路由）
  async function initialize() {
    if (initialized.value) return

    loading.value = true
    try {
      const result = await trpc.auth.validateSession.query()
      if (result?.valid && result?.user) {
        user.value = result.user
      }
    } catch (error) {
      // 静默处理 UNAUTHORIZED 错误（用户未登录是正常情况）
      if (isTRPCClientError(error) && error.data?.code === 'UNAUTHORIZED') {
        // 用户未登录，这是预期行为，不需要显示错误
        return
      }
      // 其他错误才需要记录和提示
      console.error('Failed to validate session:', error)
      toast.error('会话验证失败', '请重新登录')
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  // 设置用户信息（Cookie-only：不再保存 sessionId）
  function setUser(userData: User) {
    user.value = userData
  }

  // 登出（Cookie-only：后端清 Redis + 清 Cookie）
  async function logout() {
    loading.value = true
    try {
      await trpc.auth.logout.mutate()
      toast.success('已退出登录')
    } catch (error) {
      console.error('Logout failed:', error)
      if (isTRPCClientError(error)) {
        toast.error('退出登录失败', error.message ?? '请稍后重试')
      } else {
        toast.error('退出登录失败', '请稍后重试')
      }
    } finally {
      clearAuth()
      loading.value = false
    }
  }

  function clearAuth() {
    user.value = null
  }

  return {
    user,
    loading,
    initialized,
    isAuthenticated,
    initialize,
    setUser,
    logout,
    clearAuth,
  }
})
