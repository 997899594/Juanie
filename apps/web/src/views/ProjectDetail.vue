<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300, ease: 'easeOut' } }"
    class="container mx-auto p-6 space-y-6"
  >
    <!-- 加载状态 -->
    <div v-if="loading && !currentProject" class="flex items-center justify-center h-64">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 项目详情 -->
    <template v-else-if="currentProject">
      <!-- 页面头部 -->
      <div
        v-motion
        :initial="{ opacity: 0, x: -20 }"
        :enter="{ opacity: 1, x: 0, transition: { duration: 300, delay: 100 } }"
        class="flex items-center justify-between"
      >
        <div class="flex items-center space-x-4">
          <Button variant="ghost" size="sm" @click="router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-3xl font-bold tracking-tight">{{ currentProject.name }}</h1>
            <p class="text-muted-foreground">@{{ currentProject.slug }}</p>
          </div>
        </div>
        <Button variant="outline" @click="openEditModal">
          <Settings class="mr-2 h-4 w-4" />
          设置
        </Button>
      </div>

      <!-- 标签页 -->
      <Tabs :default-value="activeTab" @update:model-value="(value) => activeTab = String(value)">
        <TabsList class="grid w-full grid-cols-7">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="repositories">仓库</TabsTrigger>
          <TabsTrigger value="environments">环境</TabsTrigger>
          <TabsTrigger value="pipelines">Pipeline</TabsTrigger>
          <TabsTrigger value="deployments">部署</TabsTrigger>
          <TabsTrigger value="members">成员</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <!-- 概览标签 -->
        <TabsContent value="overview" class="space-y-4">
          <!-- 统计卡片 -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>环境数量</CardDescription>
                <CardTitle class="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>部署次数</CardDescription>
                <CardTitle class="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>成员数量</CardDescription>
                <CardTitle class="text-3xl">{{ members.length }}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>团队数量</CardDescription>
                <CardTitle class="text-3xl">{{ teams.length }}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <!-- 项目信息 -->
          <Card>
            <CardHeader>
              <CardTitle>项目信息</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">项目名称</span>
                  <p class="font-medium">{{ currentProject.name }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">项目标识</span>
                  <p class="font-medium">{{ currentProject.slug }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">描述</span>
                  <p class="font-medium">{{ currentProject.description || '-' }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">创建时间</span>
                  <p class="font-medium">{{ formatDate(currentProject.createdAt) }}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 项目配置 -->
          <Card v-if="currentProject.config">
            <CardHeader>
              <CardTitle>项目配置</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm">默认分支</span>
                <Badge>{{ currentProject.config.defaultBranch || 'main' }}</Badge>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">CI/CD</span>
                <Badge :variant="currentProject.config.enableCiCd ? 'default' : 'outline'">
                  {{ currentProject.config.enableCiCd ? '已启用' : '未启用' }}
                </Badge>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">AI 辅助</span>
                <Badge :variant="currentProject.config.enableAi ? 'default' : 'outline'">
                  {{ currentProject.config.enableAi ? '已启用' : '未启用' }}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 仓库标签 -->
        <TabsContent value="repositories">
          <RepositoriesTab :project-id="projectId" />
        </TabsContent>

        <!-- 环境标签 -->
        <TabsContent value="environments">
          <EnvironmentsTab :project-id="projectId" />
        </TabsContent>

        <!-- Pipeline 标签 -->
        <TabsContent value="pipelines">
          <PipelinesTab :project-id="projectId" />
        </TabsContent>

        <!-- 部署标签 -->
        <TabsContent value="deployments">
          <DeploymentsTab :project-id="projectId" />
        </TabsContent>

        <!-- 成员标签 -->
        <TabsContent value="members">
          <ProjectMemberTable
            :members="members"
            :loading="loading"
            @add="openAddMemberModal"
            @update-role="handleUpdateMemberRole"
            @remove="confirmRemoveMember"
          />
        </TabsContent>

        <!-- 设置标签 -->
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>项目设置</CardTitle>
              <CardDescription>管理项目的基本信息和配置</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <Button variant="outline" @click="openEditModal">
                <Edit class="mr-2 h-4 w-4" />
                编辑项目信息
              </Button>
              <div class="pt-4 border-t">
                <h4 class="text-sm font-semibold text-destructive mb-2">危险操作</h4>
                <Button variant="destructive" @click="confirmDelete">
                  <Trash2 class="mr-2 h-4 w-4" />
                  删除项目
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>

    <!-- 编辑项目对话框 -->
    <CreateProjectModal
      v-model:open="isEditModalOpen"
      :loading="loading"
      :project="currentProject"
      @submit="handleUpdate"
    />

    <!-- 删除确认对话框 -->
    <Dialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>确认删除项目？</DialogTitle>
          <DialogDescription>
            此操作将永久删除项目 "{{ currentProject?.name }}" 及其所有数据。此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isDeleteDialogOpen = false">取消</Button>
          <Button variant="destructive" @click="handleDelete">删除</Button>
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
  Badge,
} from '@juanie/ui'
import {
  ArrowLeft,
  Settings,
  GitBranch,
  Server,
  Rocket,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-vue-next'
import { format } from 'date-fns'
import { useProjects } from '@/composables/useProjects'
import CreateProjectModal from '@/components/CreateProjectModal.vue'
import ProjectMemberTable from '@/components/ProjectMemberTable.vue'
import RepositoriesTab from '@/components/RepositoriesTab.vue'
import EnvironmentsTab from '@/components/EnvironmentsTab.vue'
import PipelinesTab from '@/components/PipelinesTab.vue'
import DeploymentsTab from '@/components/DeploymentsTab.vue'

const route = useRoute()
const router = useRouter()
const projectId = String(route.params.id)

const {
  currentProject,
  members,
  teams,
  loading,
  fetchProject,
  fetchMembers,
  fetchTeams,
  updateProject,
  deleteProject,
  updateMemberRole,
  removeMember,
} = useProjects()

// 状态
const activeTab = ref('overview')
const isEditModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const removingMemberId = ref<string | null>(null)

// 初始化
onMounted(async () => {
  await loadProjectData()
})

// 监听路由变化
watch(
  () => route.params.id,
  async (newId) => {
    if (newId) {
      await loadProjectData()
    }
  }
)

async function loadProjectData() {
  try {
    await fetchProject(projectId)
    await fetchMembers(projectId)
    await fetchTeams(projectId)
  } catch (error) {
    console.error('Failed to load project data:', error)
  }
}

function openEditModal() {
  isEditModalOpen.value = true
}

function confirmDelete() {
  isDeleteDialogOpen.value = true
}

function openAddMemberModal() {
  // TODO: 实现添加成员对话框
}

function confirmRemoveMember(memberId: string) {
  removingMemberId.value = memberId
  // TODO: 实现移除成员确认对话框
}

async function handleUpdate(data: any) {
  try {
    await updateProject(projectId, data)
    isEditModalOpen.value = false
  } catch (error) {
    console.error('Failed to update project:', error)
  }
}

async function handleUpdateMemberRole(memberId: string, role: string) {
  try {
    await updateMemberRole(projectId, memberId, role as 'admin' | 'developer' | 'viewer')
  } catch (error) {
    console.error('Failed to update member role:', error)
  }
}

async function handleDelete() {
  try {
    await deleteProject(projectId)
    isDeleteDialogOpen.value = false
    router.push('/projects')
  } catch (error) {
    console.error('Failed to delete project:', error)
  }
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm')
}
</script>
