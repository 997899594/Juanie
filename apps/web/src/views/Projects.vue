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

    <!-- 创建项目向导 -->
    <Dialog v-model:open="isModalOpen">
      <DialogContent class="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <div class="sr-only">
          <DialogTitle>创建新项目</DialogTitle>
          <DialogDescription>
            通过向导快速创建生产可用的项目
          </DialogDescription>
        </div>
        <ProjectWizard v-if="!editingProject" @close="isModalOpen = false" />
        <CreateProjectModal
          v-else
          v-model:open="isModalOpen"
          :loading="loading"
          :project="editingProject"
          @submit="handleSubmit"
        />
      </DialogContent>
    </Dialog>

    <!-- 删除确认对话框 -->
    <Dialog v-model:open="isDeleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除项目？</DialogTitle>
          <DialogDescription>
            此操作将永久删除项目 "{{ deletingProject?.name }}" 及其所有数据。此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        
        <!-- 删除进度显示 -->
        <div v-if="showDeleteProgress" class="mb-4 p-4 border rounded-lg bg-muted/50">
          <div class="flex items-center gap-3 mb-3">
            <Loader2 class="h-5 w-5 animate-spin text-primary" />
            <div class="flex-1">
              <p class="text-sm font-medium">{{ deleteProgressMessage }}</p>
              <p v-if="jobProgress" class="text-xs text-muted-foreground mt-1">
                进度: {{ jobProgress.progress }}% - {{ jobProgress.state }}
              </p>
            </div>
          </div>
          <Progress v-if="jobProgress" :value="jobProgress.progress" class="h-2" />
        </div>

        <div class="space-y-3 py-4">
          <label class="text-sm font-medium text-foreground">Git 仓库处理</label>
          <div class="grid gap-2">
            <button
              type="button"
              @click="repositoryAction = 'keep'"
              :class="[
                'relative flex items-start gap-3 p-4 text-left rounded-lg border-2 transition-all',
                repositoryAction === 'keep'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              ]"
            >
              <div class="flex h-5 items-center">
                <div :class="[
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                  repositoryAction === 'keep' ? 'border-primary' : 'border-muted-foreground'
                ]">
                  <div v-if="repositoryAction === 'keep'" class="h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>
              <div class="flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">保留仓库</span>
                  <Badge variant="secondary" class="text-xs">推荐</Badge>
                </div>
                <p class="text-sm text-muted-foreground">项目删除后，Git 仓库将保留，可继续访问</p>
              </div>
            </button>

            <button
              type="button"
              @click="repositoryAction = 'archive'"
              :class="[
                'relative flex items-start gap-3 p-4 text-left rounded-lg border-2 transition-all',
                repositoryAction === 'archive'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              ]"
            >
              <div class="flex h-5 items-center">
                <div :class="[
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                  repositoryAction === 'archive' ? 'border-primary' : 'border-muted-foreground'
                ]">
                  <div v-if="repositoryAction === 'archive'" class="h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>
              <div class="flex-1 space-y-1">
                <span class="font-medium">归档仓库</span>
                <p class="text-sm text-muted-foreground">Git 仓库将被归档，只读状态</p>
              </div>
            </button>

            <button
              type="button"
              @click="repositoryAction = 'delete'"
              class="relative flex items-start gap-3 p-4 text-left rounded-lg border-2 transition-all"
              :class="[
                repositoryAction === 'delete'
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border hover:border-destructive/50 hover:bg-destructive/5'
              ]"
            >
              <div class="flex h-5 items-center">
                <div 
                  :class="[
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    repositoryAction === 'delete' ? 'border-destructive' : 'border-muted-foreground'
                  ]"
                >
                  <div 
                    v-if="repositoryAction === 'delete'" 
                    class="h-2 w-2 rounded-full bg-destructive"
                  />
                </div>
              </div>
              <div class="flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-destructive">删除仓库</span>
                  <Badge variant="destructive" class="text-xs">不可恢复</Badge>
                </div>
                <p class="text-sm text-muted-foreground">⚠️ Git 仓库将被永久删除，无法恢复</p>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isDeleteDialogOpen = false" :disabled="showDeleteProgress">取消</Button>
          <Button variant="destructive" :disabled="loading || showDeleteProgress" @click="handleDelete">
            <Loader2 v-if="loading || showDeleteProgress" class="mr-2 h-4 w-4 animate-spin" />
            {{ showDeleteProgress ? '删除中...' : '删除项目' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  Badge,
  Progress,
} from '@juanie/ui'
import { Plus, FolderOpen, Building, Search, Loader2 } from 'lucide-vue-next'
import { useProjects } from '@/composables/useProjects'
import { useJobProgress } from '@/composables/useJobProgress'
import { useAppStore } from '@/stores/app'

import ProjectCard from '@/components/ProjectCard.vue'
import CreateProjectModal from '@/components/CreateProjectModal.vue'
import ProjectWizard from '@/components/ProjectWizard.vue'
import PageContainer from '@/components/PageContainer.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

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
const repositoryAction = ref<'keep' | 'archive' | 'delete'>('keep')
const showDeleteProgress = ref(false)
const deleteProgressMessage = ref('')

// 使用任务进度监听
const { jobProgress, connectToJob, disconnectJob } = useJobProgress()

// 监听删除任务进度
watch(jobProgress, (newProgress) => {
  if (newProgress && showDeleteProgress.value) {
    deleteProgressMessage.value = newProgress.logs[newProgress.logs.length - 1] || '处理中...'
  }
})

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
    const jobIds = await deleteProject(deletingProject.value.id, { repositoryAction: repositoryAction.value })
    
    // 如果有异步任务（删除/归档仓库），显示进度
    if (jobIds && jobIds.length > 0 && repositoryAction.value !== 'keep') {
      showDeleteProgress.value = true
      deleteProgressMessage.value = repositoryAction.value === 'archive' ? '正在归档仓库...' : '正在删除仓库...'
      
      // 连接到第一个任务的 SSE 流
      const firstJobId = jobIds[0]
      if (firstJobId) {
        connectToJob(firstJobId)
      }
      
      // 监听任务完成
      const stopWatch = watch(
        () => jobProgress.value?.state,
        (state) => {
          if (state === 'completed' || state === 'failed') {
            setTimeout(() => {
              isDeleteDialogOpen.value = false
              deletingProject.value = null
              repositoryAction.value = 'keep'
              showDeleteProgress.value = false
              disconnectJob()
              stopWatch()
            }, 2000)
          }
        }
      )
    } else {
      isDeleteDialogOpen.value = false
      deletingProject.value = null
      repositoryAction.value = 'keep'
    }
  } catch (error) {
    console.error('Failed to delete project:', error)
    showDeleteProgress.value = false
  }
}

function navigateToProject(projectId: string) {
  router.push(`/projects/${projectId}`)
}
</script>
