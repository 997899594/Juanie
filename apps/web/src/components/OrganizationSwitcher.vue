<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="w-full justify-between">
        <div class="flex items-center space-x-2 overflow-hidden">
          <div
            class="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          >
            {{ currentOrgInitials }}
          </div>
          <span class="truncate">{{ currentOrgName }}</span>
        </div>
        <ChevronsUpDown class="ml-2 h-4 w-4 flex-shrink-0" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64" align="start">
      <DropdownMenuLabel>切换组织</DropdownMenuLabel>
      <DropdownMenuSeparator />
      
      <!-- 加载状态 -->
      <div v-if="loading" class="flex items-center justify-center py-4">
        <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
      </div>

      <!-- 组织列表 -->
      <template v-else>
        <DropdownMenuItem
          v-for="org in organizations"
          :key="org.id"
          @click="selectOrganization(org.id)"
          class="cursor-pointer"
        >
          <div class="flex items-center space-x-2 w-full">
            <div
              class="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            >
              {{ getInitials(org.name) }}
            </div>
            <div class="flex-1 overflow-hidden">
              <div class="font-medium truncate">{{ org.displayName || org.name }}</div>
              <div class="text-xs text-muted-foreground truncate">@{{ org.slug }}</div>
            </div>
            <Check
              v-if="org.id === currentOrganizationId"
              class="h-4 w-4 text-primary flex-shrink-0"
            />
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem @click="navigateToOrganizations" class="cursor-pointer">
          <Settings class="mr-2 h-4 w-4" />
          管理组织
        </DropdownMenuItem>
        
        <DropdownMenuItem @click="createNewOrganization" class="cursor-pointer">
          <Plus class="mr-2 h-4 w-4" />
          创建组织
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@juanie/ui'
import { ChevronsUpDown, Check, Settings, Plus, Loader2 } from 'lucide-vue-next'
import { useOrganizations } from '@/composables/useOrganizations'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()
const { organizations, loading, fetchOrganizations } = useOrganizations()

const currentOrganizationId = computed(() => appStore.currentOrganizationId)

const currentOrganization = computed(() => {
  if (!currentOrganizationId.value) return null
  return organizations.value.find((org: any) => org.id === currentOrganizationId.value)
})

const currentOrgName = computed(() => {
  if (!currentOrganization.value) return '选择组织'
  return currentOrganization.value.displayName || currentOrganization.value.name
})

const currentOrgInitials = computed(() => {
  if (!currentOrganization.value) return '?'
  return getInitials(currentOrganization.value.name)
})

onMounted(async () => {
  await fetchOrganizations()
  
  // 如果没有选中的组织，自动选择第一个
  if (!currentOrganizationId.value && organizations.value.length > 0) {
    const firstOrg = organizations.value[0]
    if (firstOrg) {
      appStore.setCurrentOrganization(firstOrg.id)
    }
  }
})

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function selectOrganization(orgId: string) {
  appStore.setCurrentOrganization(orgId)
  
  // 刷新当前页面数据
  router.go(0)
}

function navigateToOrganizations() {
  router.push('/organizations')
}

function createNewOrganization() {
  router.push('/organizations?action=create')
}
</script>
