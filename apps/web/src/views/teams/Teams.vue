<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">团队管理</h1>
        <p class="text-muted-foreground">管理组织内的团队和成员</p>
      </div>
      <Button @click="openCreateModal" :disabled="!currentOrganizationId">
        <Plus class="mr-2 h-4 w-4" />
        创建团队
      </Button>
    </div>

    <!-- 组织选择提示 -->
    <Card v-if="!currentOrganizationId">
      <CardContent class="flex flex-col items-center justify-center h-64 text-center">
        <Building class="h-16 w-16 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">请先选择组织</h3>
        <p class="text-muted-foreground mb-4">在侧边栏选择一个组织以查看团队</p>
      </CardContent>
    </Card>

    <template v-else>
      <!-- 错误状态 -->
      <ErrorState
        v-if="error && !loading"
        title="加载失败"
        :message="error"
        @retry="() => currentOrganizationId && fetchTeams(currentOrganizationId)"
      />

      <!-- 加载状态 -->
      <LoadingState v-else-if="loading && !hasTeams" message="加载团队中..." />

      <!-- 空状态 -->
      <EmptyState
        v-else-if="!loading && !hasTeams && !error"
        :icon="Users"
        title="还没有团队"
        description="创建第一个团队来组织成员"
        action-label="创建团队"
        :action-icon="Plus"
        @action="openCreateModal"
      />

      <!-- 团队列表 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          v-for="(team, index) in teams"
          :key="team.id"
          class="group cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :enter="{ opacity: 1, y: 0, transition: { duration: 300, delay: index * 50 } }"
          @click="navigateToTeam(team.id)"
        >
          <CardHeader>
            <div class="flex items-start justify-between">
              <div>
                <CardTitle class="text-lg">{{ team.name }}</CardTitle>
                <CardDescription>{{ team.description || '暂无描述' }}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2 text-sm text-muted-foreground">
                <Users class="h-4 w-4" />
                <span>0 成员</span>
              </div>
              <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" @click.stop="openEditModal(team)">
                  <Edit class="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" @click.stop="confirmDelete(team)">
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- 创建/编辑团队对话框 -->
    <Dialog :open="isModalOpen" @update:open="isModalOpen = $event">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{{ isEdit ? '编辑团队' : '创建团队' }}</DialogTitle>
          <DialogDescription>
            {{ isEdit ? '更新团队信息' : '在当前组织中创建一个新团队' }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="name">团队名称</Label>
            <Input
              id="name"
              v-model="formData.name"
              placeholder="例如：开发团队"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="description">描述（可选）</Label>
            <Input
              id="description"
              v-model="formData.description"
              placeholder="团队描述"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="isModalOpen = false">
              取消
            </Button>
            <Button type="submit" :disabled="loading">
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              {{ isEdit ? '更新' : '创建' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:open="isDeleteDialogOpen"
      title="确认删除团队？"
      :description="`此操作将永久删除团队 &quot;${deletingTeam?.name}&quot; 及其所有数据。此操作无法撤销。`"
      confirm-label="删除"
      variant="destructive"
      :loading="loading"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@juanie/ui'
import { Plus, Users, Building, Edit, Trash2 } from 'lucide-vue-next'
import { useTeams } from '@/composables/useTeams'
import { useAppStore } from '@/stores/app'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const appStore = useAppStore()
const {
  teams,
  loading,
  error,
  hasTeams,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
} = useTeams()

const currentOrganizationId = computed(() => appStore.currentOrganizationId)

// 对话框状态
const isModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const isEdit = ref(false)
const editingTeam = ref<any>(null)
const deletingTeam = ref<any>(null)

const formData = ref({
  name: '',
  description: '',
})

// 监听组织变化
watch(currentOrganizationId, async (orgId) => {
  if (orgId) {
    await fetchTeams(orgId)
  }
})

onMounted(async () => {
  if (currentOrganizationId.value) {
    await fetchTeams(currentOrganizationId.value)
  }
})

function openCreateModal() {
  isEdit.value = false
  editingTeam.value = null
  formData.value = {
    name: '',
    description: '',
  }
  isModalOpen.value = true
}

function openEditModal(team: any) {
  isEdit.value = true
  editingTeam.value = team
  formData.value = {
    name: team.name,
    description: team.description || '',
  }
  isModalOpen.value = true
}

function confirmDelete(team: any) {
  deletingTeam.value = team
  isDeleteDialogOpen.value = true
}

async function handleSubmit() {
  if (!currentOrganizationId.value) return

  try {
    if (isEdit.value && editingTeam.value) {
      await updateTeam(editingTeam.value.id, {
        name: formData.value.name,
        description: formData.value.description || undefined,
      })
    } else {
      await createTeam({
        organizationId: currentOrganizationId.value,
        name: formData.value.name,
        description: formData.value.description || undefined,
      })
    }
    isModalOpen.value = false
  } catch (error) {
    console.error('Failed to submit team:', error)
  }
}

async function handleDelete() {
  if (!deletingTeam.value) return

  try {
    await deleteTeam(deletingTeam.value.id)
    isDeleteDialogOpen.value = false
    deletingTeam.value = null
  } catch (error) {
    console.error('Failed to delete team:', error)
  }
}

function navigateToTeam(teamId: string) {
  router.push(`/teams/${teamId}`)
}
</script>
