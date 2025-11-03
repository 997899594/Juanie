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
    const sessionId = ref<string | null>(null)
    const loading = ref(false)
    const initialized = ref(false)

    // 计算属性
    const isAuthenticated = computed(() => !!user.value && !!sessionId.value)

    // 初始化认证状态
    async function initialize() {
      if (initialized.value) return

      loading.value = true
      try {
        // 从localStorage获取会话ID
        const storedSessionId = localStorage.getItem('sessionId')
        if (storedSessionId) {
          const result = await trpc.auth.validateSession.query({
            sessionId: storedSessionId,
          })

          if (result?.valid && result?.user) {
            user.value = result.user
            sessionId.value = storedSessionId
          }
        }
      } catch (error) {
        console.error('Failed to validate session:', error)
        // 清除无效的session
        localStorage.removeItem('sessionId')

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
    function setAuth(userData: User, session: string) {
      user.value = userData
      sessionId.value = session
      // 保存session ID到localStorage
      localStorage.setItem('sessionId', session)
    }

    // 登出
    async function logout() {
      loading.value = true
      try {
        if (sessionId.value) {
          await trpc.auth.logout.mutate({
            sessionId: sessionId.value,
          })
        }
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
      sessionId.value = null
      initialized.value = false
      localStorage.removeItem('sessionId')
    }

    return {
      // 状态
      user,
      sessionId,
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
    // 持久化配置 - 只持久化 sessionId
    persist: {
      paths: ['sessionId'],
    },
  },
)
