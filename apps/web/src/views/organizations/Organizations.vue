<template>
  <div class="space-y-6">
    <!-- 页面头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">组织管理</h1>
        <p class="text-muted-foreground">管理你的组织、团队和成员</p>
      </div>
      <Button @click="openCreateModal">
        <Plus class="mr-2 h-4 w-4" />
        创建组织
      </Button>
    </div>

    <!-- 错误状态 -->
    <ErrorState
      v-if="error && !loading"
      title="加载失败"
      :message="error"
      @retry="fetchOrganizations"
    />

    <!-- 加载状态 -->
    <LoadingState v-else-if="loading && !hasOrganizations" message="加载组织中..." />

    <!-- 空状态 -->
    <EmptyState
      v-else-if="!loading && !hasOrganizations && !error"
      :icon="Building"
      title="还没有组织"
      description="创建你的第一个组织来开始管理团队和项目"
      action-label="创建组织"
      :action-icon="Plus"
      @action="openCreateModal"
    />

    <!-- 组织列表 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <OrganizationCard
        v-for="(org, index) in organizations"
        :key="org.id"
        :organization="org"
        :index="index"
        :member-count="0"
        :project-count="0"
        @click="navigateToOrganization(org.id)"
        @edit="openEditModal(org)"
        @delete="confirmDelete(org)"
      />
    </div>

    <!-- 创建/编辑组织对话框 -->
    <CreateOrganizationModal
      v-model:open="isModalOpen"
      :loading="loading"
      :organization="editingOrganization"
      @submit="handleSubmit"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:open="isDeleteDialogOpen"
      title="确认删除组织？"
      :description="`此操作将永久删除组织 &quot;${deletingOrganization?.name}&quot; 及其所有数据。此操作无法撤销。`"
      confirm-label="删除"
      variant="destructive"
      :loading="loading"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
} from '@juanie/ui'
import { Plus, Building } from 'lucide-vue-next'
import { useOrganizations } from '@/composables/useOrganizations'
import OrganizationCard from '@/components/OrganizationCard.vue'
import CreateOrganizationModal from '@/components/CreateOrganizationModal.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const {
  organizations,
  loading,
  error,
  hasOrganizations,
  fetchOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} = useOrganizations()

// 对话框状态
const isModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingOrganization = ref<any>(null)
const deletingOrganization = ref<any>(null)

// 初始化
onMounted(async () => {
  await fetchOrganizations()
})

// 打开创建对话框
function openCreateModal() {
  editingOrganization.value = null
  isModalOpen.value = true
}

// 打开编辑对话框
function openEditModal(org: any) {
  editingOrganization.value = org
  isModalOpen.value = true
}

// 确认删除
function confirmDelete(org: any) {
  deletingOrganization.value = org
  isDeleteDialogOpen.value = true
}

// 处理提交（创建或更新）
async function handleSubmit(data: { name: string; slug: string; displayName?: string }) {
  try {
    if (editingOrganization.value) {
      await updateOrganization(editingOrganization.value.id, data)
    } else {
      await createOrganization(data)
    }
    isModalOpen.value = false
    editingOrganization.value = null
  } catch (error) {
    // 错误已在 composable 中处理
    console.error('Failed to submit organization:', error)
  }
}

// 处理删除
async function handleDelete() {
  if (!deletingOrganization.value) return

  try {
    await deleteOrganization(deletingOrganization.value.id)
    isDeleteDialogOpen.value = false
    deletingOrganization.value = null
  } catch (error) {
    // 错误已在 composable 中处理
    console.error('Failed to delete organization:', error)
  }
}

// 导航到组织详情
function navigateToOrganization(orgId: string) {
  router.push(`/organizations/${orgId}`)
}
</script>
