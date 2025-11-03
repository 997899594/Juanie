import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore(
  'app',
  () => {
    // 侧边栏状态
    const sidebarCollapsed = ref(false)

    // 当前组织
    const currentOrganizationId = ref<string | null>(null)

    // 面包屑
    const breadcrumbs = ref<Array<{ label: string; to?: string }>>([])

    // 方法
    function toggleSidebar() {
      sidebarCollapsed.value = !sidebarCollapsed.value
    }

    function setCurrentOrganization(orgId: string | null) {
      currentOrganizationId.value = orgId
    }

    function setBreadcrumbs(items: Array<{ label: string; to?: string }>) {
      breadcrumbs.value = items
    }

    return {
      sidebarCollapsed,
      currentOrganizationId,
      breadcrumbs,
      toggleSidebar,
      setCurrentOrganization,
      setBreadcrumbs,
    }
  },
  {
    persist: {
      key: 'app-store',
      storage: localStorage,
      paths: ['sidebarCollapsed', 'currentOrganizationId'],
    },
  },
)
