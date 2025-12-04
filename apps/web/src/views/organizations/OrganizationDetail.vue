<template>
  <div class="space-y-6">
    <!-- 加载状态 -->
    <div v-if="loading && !currentOrganization" class="flex items-center justify-center h-64">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 组织详情 -->
    <template v-else-if="currentOrganization">
      <!-- 页面头部 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <Button variant="ghost" size="sm" @click="router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-3xl font-bold tracking-tight">
              {{ currentOrganization.displayName || currentOrganization.name }}
            </h1>
            <p class="text-muted-foreground">@{{ currentOrganization.slug }}</p>
          </div>
        </div>
        <Button variant="outline" @click="openEditModal">
          <Settings class="mr-2 h-4 w-4" />
          设置
        </Button>
      </div>

      <!-- 标签页 -->
      <Tabs :default-value="activeTab" @update:model-value="(value) => activeTab = String(value)">
        <TabsList class="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="members">成员</TabsTrigger>
          <TabsTrigger value="teams">团队</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <!-- 概览标签 -->
        <TabsContent value="overview" class="space-y-4">
          <!-- 统计卡片 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>成员数量</CardDescription>
                <CardTitle class="text-3xl">{{ members.length }}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>项目数量</CardDescription>
                <CardTitle class="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>团队数量</CardDescription>
                <CardTitle class="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <!-- 配额使用情况 -->
          <Card v-if="quotaUsage">
            <CardHeader>
              <CardTitle>配额使用情况</CardTitle>
              <CardDescription>查看组织的资源配额和使用情况</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div v-for="(value, key) in quotaUsage" :key="key" class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium">{{ formatQuotaKey(key) }}</span>
                  <span class="text-muted-foreground">{{ value }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 组织信息 -->
          <Card>
            <CardHeader>
              <CardTitle>组织信息</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">组织名称</span>
                  <p class="font-medium">{{ currentOrganization.name }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">组织标识</span>
                  <p class="font-medium">{{ currentOrganization.slug }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">显示名称</span>
                  <p class="font-medium">{{ currentOrganization.displayName || '-' }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">创建时间</span>
                  <p class="font-medium">{{ formatDate(currentOrganization.createdAt) }}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 成员标签 -->
        <TabsContent value="members">
          <OrganizationMemberTable
            :members="members"
            :loading="loading"
            :current-user-role="currentOrganization.role"
            @invite="openInviteModal"
            @update-role="handleUpdateRole"
            @remove="confirmRemoveMember"
          />
        </TabsContent>

        <!-- 团队标签 -->
        <TabsContent value="teams">
          <Card>
            <CardContent class="flex flex-col items-center justify-center h-64 text-center">
              <Users class="h-16 w-16 text-muted-foreground mb-4" />
              <h3 class="text-lg font-semibold mb-2">团队功能开发中</h3>
              <p class="text-muted-foreground">团队管理功能即将上线</p>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 设置标签 -->
        <TabsContent value="settings" class="space-y-4">
          <!-- Git 同步状态 -->
          <OrganizationGitSyncStatus
            :organization="currentOrganization"
            :syncing="syncingGit"
            :sync-stats="gitSyncStats"
            @enable-sync="handleEnableGitSync"
            @sync-now="handleSyncNow"
            @view-logs="handleViewLogs"
            @configure="handleConfigureGitSync"
          />

          <!-- 基本设置 -->
          <Card>
            <CardHeader>
              <CardTitle>组织设置</CardTitle>
              <CardDescription>管理组织的基本信息和配置</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <Button variant="outline" @click="openEditModal">
                <Edit class="mr-2 h-4 w-4" />
                编辑组织信息
              </Button>
              <div class="pt-4 border-t">
                <h4 class="text-sm font-semibold text-destructive mb-2">危险操作</h4>
                <Button variant="destructive" @click="confirmDelete">
                  <Trash2 class="mr-2 h-4 w-4" />
                  删除组织
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>

    <!-- 编辑组织对话框 -->
    <CreateOrganizationModal
      v-model:open="isEditModalOpen"
      :loading="loading"
      :organization="currentOrganization"
      @submit="handleUpdate"
    />

    <!-- 邀请成员对话框 -->
    <Dialog :open="isInviteModalOpen" @update:open="isInviteModalOpen = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
          <DialogDescription>输入用户 ID 邀请成员加入组织</DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleInvite" class="space-y-4">
          <div class="space-y-2">
            <Label for="userId">用户 ID</Label>
            <Input
              id="userId"
              v-model="inviteForm.userId"
              placeholder="输入用户 ID"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="role">角色</Label>
            <Select v-model="inviteForm.role">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="member">成员</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="isInviteModalOpen = false">
              取消
            </Button>
            <Button type="submit" :disabled="loading">
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              邀请
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 删除确认对话框 -->
    <Dialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>确认删除组织？</DialogTitle>
          <DialogDescription>
            此操作将永久删除组织 "{{ currentOrganization?.name }}" 及其所有数据。此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isDeleteDialogOpen = false">取消</Button>
          <Button variant="destructive" @click="handleDelete">删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 移除成员确认对话框 -->
    <Dialog :open="isRemoveMemberDialogOpen" @update:open="isRemoveMemberDialogOpen = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>确认移除成员？</DialogTitle>
          <DialogDescription>
            此操作将从组织中移除该成员。成员将失去对组织资源的访问权限。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isRemoveMemberDialogOpen = false">取消</Button>
          <Button variant="destructive" @click="handleRemoveMember">移除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@juanie/ui'
import {
  ArrowLeft,
  Settings,
  Users,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-vue-next'
import { format } from 'date-fns'
import { useOrganizations } from '@/composables/useOrganizations'
import { useToast } from '@/composables/useToast'
import OrganizationMemberTable from '@/components/OrganizationMemberTable.vue'
import CreateOrganizationModal from '@/components/CreateOrganizationModal.vue'
import OrganizationGitSyncStatus from '@/components/OrganizationGitSyncStatus.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const orgId = String(route.params.id)

const {
  currentOrganization,
  members,
  quotaUsage,
  loading,
  fetchOrganization,
  fetchMembers,
  fetchQuotaUsage,
  updateOrganization,
  deleteOrganization,
  inviteMember,
  updateMemberRole,
  removeMember,
} = useOrganizations()

// 状态
const activeTab = ref('overview')
const isEditModalOpen = ref(false)
const isInviteModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const isRemoveMemberDialogOpen = ref(false)
const removingMemberId = ref<string | null>(null)
const syncingGit = ref(false)
const gitSyncStats = ref<{ totalMembers: number; syncedMembers: number; failedMembers: number } | null>(null)

const inviteForm = ref({
  userId: '',
  role: 'member' as 'admin' | 'member',
})

// 初始化
onMounted(async () => {
  await loadOrganizationData()
})

// 监听路由变化
watch(
  () => route.params.id,
  async (newId) => {
    if (newId) {
      await loadOrganizationData()
    }
  }
)

async function loadOrganizationData() {
  try {
    await fetchOrganization(orgId)
    await fetchMembers(orgId)
    await fetchQuotaUsage(orgId)
  } catch (error) {
    log.error('Failed to load organization data:', error)
  }
}

function openEditModal() {
  isEditModalOpen.value = true
}

function openInviteModal() {
  inviteForm.value = {
    userId: '',
    role: 'member',
  }
  isInviteModalOpen.value = true
}

function confirmDelete() {
  isDeleteDialogOpen.value = true
}

function confirmRemoveMember(memberId: string) {
  removingMemberId.value = memberId
  isRemoveMemberDialogOpen.value = true
}

async function handleUpdate(data: { name?: string; slug?: string; displayName?: string }) {
  try {
    await updateOrganization(orgId, data)
    isEditModalOpen.value = false
  } catch (error) {
    log.error('Failed to update organization:', error)
  }
}

async function handleInvite() {
  try {
    await inviteMember(orgId, inviteForm.value.userId, inviteForm.value.role)
    isInviteModalOpen.value = false
  } catch (error) {
    log.error('Failed to invite member:', error)
  }
}

async function handleUpdateRole(memberId: string, role: string) {
  try {
    await updateMemberRole(orgId, memberId, role as 'admin' | 'member')
  } catch (error) {
    log.error('Failed to update member role:', error)
  }
}

async function handleRemoveMember() {
  if (!removingMemberId.value) return

  try {
    await removeMember(orgId, removingMemberId.value)
    isRemoveMemberDialogOpen.value = false
    removingMemberId.value = null
  } catch (error) {
    log.error('Failed to remove member:', error)
  }
}

async function handleDelete() {
  try {
    await deleteOrganization(orgId)
    isDeleteDialogOpen.value = false
    router.push('/organizations')
  } catch (error) {
    log.error('Failed to delete organization:', error)
  }
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm')
}

function formatQuotaKey(key: string): string {
  const labels: Record<string, string> = {
    maxProjects: '最大项目数',
    maxMembers: '最大成员数',
    maxTeams: '最大团队数',
  }
  return labels[key] || key
}

// Git 同步相关函数
function handleEnableGitSync() {
  toast.info('功能开发中', '启用 Git 同步功能即将上线')
}

async function handleSyncNow() {
  syncingGit.value = true
  try {
    toast.info('同步中', '正在同步组织成员到 Git 平台...')
    // TODO: 调用同步 API
    await new Promise(resolve => setTimeout(resolve, 2000))
    toast.success('同步成功', '组织成员已同步到 Git 平台')
  } catch (error) {
    log.error('Failed to sync:', error)
    toast.error('同步失败', '同步组织成员失败，请稍后重试')
  } finally {
    syncingGit.value = false
  }
}

function handleViewLogs() {
  toast.info('功能开发中', '同步日志查看功能即将上线')
}

function handleConfigureGitSync() {
  toast.info('功能开发中', 'Git 同步配置功能即将上线')
}
</script>
