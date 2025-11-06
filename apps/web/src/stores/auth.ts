import type { inferRouterOutputs } from '@trpc/server'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { type AppRouter, isTRPCClientError, trpc } from '@/lib/trpc'

// 使用 tRPC 推断的类型
type RouterOutput = inferRouterOutputs<AppRouter>
type ValidateSessionOutput = RouterOutput['auth']['validateSession']
type User = ValidateSessionOutput['user']

export const useAuthStore = defineStore(
  'auth',
  () => {
    const toast = useToast()

    // 状态
    const user = ref<User | null>(null)
    const loading = ref(false)
    const initialized = ref(false)

    // 计算属性
    const isAuthenticated = computed(() => !!user.value)

    // 初始化认证状态
    async function initialize() {
      if (initialized.value) return

      loading.value = true
      try {
        const result = await trpc.auth.validateSession.query()
        if (result?.valid && result?.user) {
          user.value = result.user
        }
      } catch (error) {
        console.error('Failed to validate session:', error)
        // 显示错误提示（仅在非认证错误时）
        if (isTRPCClientError(error) && error.data?.code !== 'UNAUTHORIZED') {
          toast.error('会话验证失败', '请重新登录')
        }
      } finally {
        loading.value = false
        initialized.value = true
      }
    }

    // 设置用户信息和会话
    function setAuth(userData: User) {
      user.value = userData
    }

    // 登出
    async function logout() {
      loading.value = true
      try {
        await trpc.auth.logout.mutate()
        toast.success('已退出登录')
      } catch (error) {
        console.error('Logout failed:', error)
        if (isTRPCClientError(error)) {
          toast.error('退出登录失败', error.message)
        }
      } finally {
        clearAuth()
        loading.value = false
      }
    }

    // 清除状态（用于登出后清理）
    function clearAuth() {
      user.value = null
      initialized.value = false
    }

    return {
      // 状态
      user,
      loading,
      initialized,

      // 计算属性
      isAuthenticated,

      // 方法
      initialize,
      setAuth,
      logout,
      clearAuth,
    }
  },
  {
    // 不持久化会话（由 HTTP-only Cookie 管理）
    persist: false,
  },
)
