import type { AppRouter } from "@juanie/api-ai";
import type { inferRouterOutputs } from "@trpc/server";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { trpc } from "../lib/trpc";

// 使用 tRPC 推断的类型，正确处理可能为 null 的返回值
type RouterOutput = inferRouterOutputs<AppRouter>;
type ValidateSessionOutput = RouterOutput["auth"]["validateSession"];
type User = NonNullable<ValidateSessionOutput>["user"];
type Session = NonNullable<ValidateSessionOutput>["session"];

export const useAuthStore = defineStore("auth", () => {
  // 状态
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  // 计算属性
  const isAuthenticated = computed(() => !!user.value && !!session.value);

  // 初始化认证状态
  async function initialize() {
    if (initialized.value) return;

    loading.value = true;
    try {
      // 从localStorage获取会话token
      const sessionToken = localStorage.getItem("sessionToken");
      if (sessionToken) {
        const result = await trpc.auth.validateSession.query({
          sessionToken,
        });

        if (result?.user && result?.session) {
          // 直接使用 tRPC 返回的数据，无需手动转换
          user.value = result.user;
          session.value = result.session;
        }
      }
    } catch (error) {
      console.error("Failed to validate session:", error);
      // 清除无效的session token
      localStorage.removeItem("sessionToken");
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  // 设置用户信息
  function setUser(userData: User | null) {
    user.value = userData;
  }

  // 设置会话信息
  function setSession(sessionData: Session | null) {
    session.value = sessionData;
    // 保存session token到localStorage
    if (sessionData?.sessionTokenHash) {
      localStorage.setItem("sessionToken", sessionData.sessionTokenHash);
    }
  }

  // 登出
  async function logout() {
    loading.value = true;
    try {
      if (session.value) {
        await trpc.auth.revokeSession.mutate({
          sessionToken: session.value.sessionTokenHash,
        });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearAuth();
      loading.value = false;
    }
  }

  // 清除状态（用于登出后清理）
  function clearAuth() {
    user.value = null;
    session.value = null;
    initialized.value = false;
    localStorage.removeItem("sessionToken");
  }

  return {
    // 状态
    user,
    session,
    loading,
    initialized,

    // 计算属性
    isAuthenticated,

    // 方法
    initialize,
    setUser,
    setSession,
    logout,
    clearAuth,
  };
});
