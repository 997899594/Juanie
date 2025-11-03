<template>
  <PageContainer title="项目管理" description="管理你的应用和服务项目">
    <template #actions>
      <Button @click="openCreateModal" :disabled="!currentOrganizationId">
        <Plus class="mr-2 h-4 w-4" />
        创建项目
      </Button>
    </template>

    <!-- 组织选择提示 -->
    <Card v-if="!currentOrganizationId">
      <CardContent class="flex flex-col items-center justify-center h-64 text-center">
        <Building class="h-16 w-16 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">请先选择组织</h3>
        <p class="text-muted-foreground mb-4">在侧边栏选择一个组织以查看项目</p>
      </CardContent>
    </Card>

    <template v-else>
      <!-- 搜索 -->
      <div class="flex items-center space-x-4">
        <div class="flex-1">
          <Input
            v-model="searchQuery"
            placeholder="搜索项目..."
            class="max-w-sm"
          >
            <template #prefix>
              <Search class="h-4 w-4 text-muted-foreground" />
            </template>
          </Input>
        </div>
      </div>

      <!-- 错误状态 -->
      <ErrorState
        v-if="error && !loading"
        title="加载失败"
        :message="error"
        @retry="() => currentOrganizationId && fetchProjects(currentOrganizationId)"
      />

      <!-- 加载状态 -->
      <LoadingState v-else-if="loading && !hasProjects" message="加载项目中..." />

      <!-- 空状态 -->
      <EmptyState
        v-else-if="!loading && !hasProjects && !error"
        :icon="FolderOpen"
        title="还没有项目"
        description="创建第一个项目来开始管理应用"
        action-label="创建项目"
        :action-icon="Plus"
        @action="openCreateModal"
      />

      <!-- 无搜索结果 -->
      <EmptyState
        v-else-if="filteredProjects.length === 0"
        :icon="Search"
        title="未找到项目"
        description="尝试调整搜索条件"
      />

      <!-- 项目列表 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProjectCard
          v-for="(project, index) in filteredProjects"
          :key="project.id"
          :project="project"
          :index="index"
          @click="navigateToProject(project.id)"
          @edit="openEditModal(project)"
          @delete="confirmDelete(project)"
        />
      </div>
    </template>

    <!-- 创建/编辑项目对话框 -->
    <CreateProjectModal
      v-model:open="isModalOpen"
      :loading="loading"
      :project="editingProject"
      @submit="handleSubmit"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:open="isDeleteDialogOpen"
      title="确认删除项目？"
      :description="`此操作将永久删除项目 &quot;${deletingProject?.name}&quot; 及其所有数据。此操作无法撤销。`"
      confirm-label="删除"
      variant="destructive"
      :loading="loading"
      @confirm="handleDelete"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  Card,
  CardContent,
  Input,
} from '@juanie/ui'
import { Plus, FolderOpen, Building, Search } from 'lucide-vue-next'
import { useProjects } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'
import ProjectCard from '@/components/ProjectCard.vue'
import CreateProjectModal from '@/components/CreateProjectModal.vue'
import PageContainer from '@/components/PageContainer.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const appStore = useAppStore()
const {
  projects,
  loading,
  error,
  hasProjects,
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} = useProjects()

const currentOrganizationId = computed(() => appStore.currentOrganizationId)

// 搜索
const searchQuery = ref('')

// 对话框状态
const isModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingProject = ref<any>(null)
const deletingProject = ref<any>(null)

// 过滤后的项目列表
const filteredProjects = computed(() => {
  let result = projects.value

  // 按搜索关键词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.slug.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
    )
  }

  return result
})

// 监听组织变化
watch(currentOrganizationId, async (orgId) => {
  if (orgId) {
    await fetchProjects(orgId)
  }
})

onMounted(async () => {
  if (currentOrganizationId.value) {
    await fetchProjects(currentOrganizationId.value)
  }
})

function openCreateModal() {
  editingProject.value = null
  isModalOpen.value = true
}

function openEditModal(project: any) {
  editingProject.value = project
  isModalOpen.value = true
}

function confirmDelete(project: any) {
  deletingProject.value = project
  isDeleteDialogOpen.value = true
}

async function handleSubmit(data: any) {
  if (!currentOrganizationId.value) return

  try {
    if (editingProject.value) {
      await updateProject(editingProject.value.id, data)
    } else {
      await createProject({
        organizationId: currentOrganizationId.value,
        ...data,
      })
    }
    isModalOpen.value = false
    editingProject.value = null
  } catch (error) {
    console.error('Failed to submit project:', error)
  }
}

async function handleDelete() {
  if (!deletingProject.value) return

  try {
    await deleteProject(deletingProject.value.id)
    isDeleteDialogOpen.value = false
    deletingProject.value = null
  } catch (error) {
    console.error('Failed to delete project:', error)
  }
}

function navigateToProject(projectId: string) {
  router.push(`/projects/${projectId}`)
}
</script>
