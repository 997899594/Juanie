<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="gap-2">
        <Avatar class="h-6 w-6">
          <AvatarImage :src="currentWorkspace?.avatar" />
          <AvatarFallback>
            <component :is="workspaceIcon" class="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <span class="hidden md:inline">{{ currentWorkspace?.name || '选择工作空间' }}</span>
        <ChevronsUpDown class="h-4 w-4 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    
    <DropdownMenuContent align="end" class="w-64">
      <!-- 个人工作空间 -->
      <DropdownMenuLabel class="text-xs text-muted-foreground">
        个人工作空间
      </DropdownMenuLabel>
      <DropdownMenuItem 
        v-if="personalWorkspace"
        @click="handleSwitch(personalWorkspace.id)"
        :class="{ 'bg-accent': currentWorkspace?.id === personalWorkspace.id }"
      >
        <User class="mr-2 h-4 w-4" />
        <span>{{ personalWorkspace.name }}</span>
        <Check v-if="currentWorkspace?.id === personalWorkspace.id" class="ml-auto h-4 w-4" />
      </DropdownMenuItem>
      
      <!-- 组织工作空间 -->
      <template v-if="organizationWorkspaces.length > 0">
        <DropdownMenuSeparator />
        <DropdownMenuLabel class="text-xs text-muted-foreground">
          组织工作空间
        </DropdownMenuLabel>
        <DropdownMenuItem 
          v-for="org in organizationWorkspaces" 
          :key="org.id"
          @click="handleSwitch(org.id)"
          :class="{ 'bg-accent': currentWorkspace?.id === org.id }"
        >
          <Building class="mr-2 h-4 w-4" />
          <div class="flex flex-col">
            <span>{{ org.name }}</span>
            <span class="text-xs text-muted-foreground">{{ org.role }}</span>
          </div>
          <Check v-if="currentWorkspace?.id === org.id" class="ml-auto h-4 w-4" />
        </DropdownMenuItem>
      </template>
      
      <!-- 操作 -->
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="showCreateOrg = true">
        <Plus class="mr-2 h-4 w-4" />
        创建组织
      </DropdownMenuItem>
      <DropdownMenuItem @click="showJoinOrg = true">
        <UserPlus class="mr-2 h-4 w-4" />
        加入组织
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- 创建组织对话框 -->
  <Dialog v-model:open="showCreateOrg">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>创建组织</DialogTitle>
        <DialogDescription>
          创建一个新的组织工作空间，用于团队协作
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="orgName">组织名称</Label>
          <Input
            id="orgName"
            v-model="newOrgName"
            placeholder="Acme Corp"
          />
        </div>
        <div class="space-y-2">
          <Label for="provider">Git Provider</Label>
          <Select v-model="newOrgProvider">
            <SelectTrigger>
              <SelectValue placeholder="选择 Git Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="github">GitHub</SelectItem>
              <SelectItem value="gitlab">GitLab</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="showCreateOrg = false">
          取消
        </Button>
        <Button @click="handleCreateOrg" :disabled="!newOrgName || !newOrgProvider">
          创建
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Avatar, AvatarFallback, AvatarImage } from '@juanie/ui'
import { Button } from '@juanie/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@juanie/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@juanie/ui'
import { Input } from '@juanie/ui'
import { Label } from '@juanie/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@juanie/ui'
import { Building, Check, ChevronsUpDown, Plus, User, UserPlus } from 'lucide-vue-next'
import { useWorkspaceStore } from '@/stores/workspace'
import { useToast } from '@/composables/useToast'

const workspaceStore = useWorkspaceStore()
const { currentWorkspace, personalWorkspace, organizationWorkspaces } = storeToRefs(workspaceStore)
const toast = useToast()

const showCreateOrg = ref(false)
const showJoinOrg = ref(false)
const newOrgName = ref('')
const newOrgProvider = ref<'github' | 'gitlab'>()

const workspaceIcon = computed(() => {
  return currentWorkspace.value?.type === 'personal' ? User : Building
})

async function handleSwitch(workspaceId: string) {
  try {
    await workspaceStore.switchWorkspace(workspaceId)
    
    toast.success('工作空间已切换', `当前: ${currentWorkspace.value?.name}`)
  } catch (error: any) {
    toast.error('切换失败', error.message)
  }
}

async function handleCreateOrg() {
  if (!newOrgName.value || !newOrgProvider.value) return

  try {
    await workspaceStore.createOrganization({
      name: newOrgName.value,
      provider: newOrgProvider.value,
    })

    toast.success('组织创建成功', `已切换到 ${newOrgName.value}`)

    showCreateOrg.value = false
    newOrgName.value = ''
    newOrgProvider.value = undefined
  } catch (error: any) {
    toast.error('创建失败', error.message)
  }
}
</script>
