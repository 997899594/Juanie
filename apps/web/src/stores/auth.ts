import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { trpc } from "@/lib/trpc";

export interface User {
  id: number;
  email: string;
  name: string;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const useAuthStore = defineStore("auth", () => {
  // 状态
  const user = ref<User | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  // 计算属性
  const isAuthenticated = computed(() => !!user.value);

  // 初始化认证状态
  async function initialize() {
    if (initialized.value) return;

    loading.value = true;
    try {
      const result = await trpc.auth.checkAuth.query();
      if (result.data.isAuthenticated && result.data.user) {
        user.value = result.data.user;
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  // 获取当前用户信息
  async function getCurrentUser() {
    loading.value = true;
    try {
      const currentUser = await trpc.auth.getCurrentUser.query();
      user.value = currentUser;
      return currentUser;
    } catch (error) {
      user.value = null;
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 获取 GitHub 登录 URL
  async function getGitHubAuthUrl(redirectTo?: string) {
    const result = await trpc.auth.getGitLabAuthUrl.query({
      provider: "github",
      redirectTo,
    });
    return result.url;
  }

  // 获取 GitLab 登录 URL
  async function getGitLabAuthUrl(redirectTo?: string) {
    const result = await trpc.auth.getGitLabAuthUrl.query({
      provider: "gitlab",
      redirectTo,
    });
    return result.url;
  }

  // 登出
  async function logout() {
    loading.value = true;
    try {
      await trpc.auth.logout.mutate();
      user.value = null;
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 清除状态（用于登出后清理）
  function clearAuth() {
    user.value = null;
    initialized.value = false;
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
    getCurrentUser,
    getGitHubAuthUrl,
    getGitLabAuthUrl,
    logout,
    clearAuth,
  };
});
