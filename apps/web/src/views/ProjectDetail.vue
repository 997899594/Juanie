<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- 项目头部 -->
    <Card class="mb-6">
      <CardContent class="p-6">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between">
          <div class="flex items-start space-x-4 flex-1">
            <Avatar class="w-12 h-12">
              <AvatarImage v-if="project?.avatar" :src="project.avatar" :alt="project.name" />
              <AvatarFallback>
                <Folder class="w-6 h-6" />
              </AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-3 mb-2">
                <h1 class="text-2xl font-bold text-foreground">{{ project?.name || '加载中...' }}</h1>
                <div class="flex items-center space-x-2">
                  <Badge v-if="project?.isPublic" variant="secondary">
                    <Globe class="w-3 h-3 mr-1" />
                    公开
                  </Badge>
                  <Badge v-else variant="outline">
                    <Lock class="w-3 h-3 mr-1" />
                    私有
                  </Badge>
                  <Badge v-if="project?.gitlabProjectId" variant="outline">
                    <GitBranch class="w-3 h-3 mr-1" />
                    GitLab
                  </Badge>
                </div>
              </div>
              <p class="text-muted-foreground mb-3">{{ project?.description || '暂无描述' }}</p>
              <div class="flex items-center space-x-4 text-sm text-muted-foreground">
                <span class="flex items-center">
                  <User class="w-4 h-4 mr-1" />
                  {{ project?.owner?.name || '未知用户' }}
                </span>
                <span class="flex items-center">
                  <Clock class="w-4 h-4 mr-1" />
                  更新于 {{ formatTime(project?.updatedAt) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center space-x-3 mt-4 lg:mt-0">
            <Button 
              v-if="canEdit"
              variant="outline"
              @click="showEditModal = true"
            >
              <Edit class="w-4 h-4 mr-2" />
              编辑项目
            </Button>
            <Button>
              <Plus class="w-4 h-4 mr-2" />
              新建部署
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 标签页导航 -->
    <Card class="mb-6">
      <Tabs :value="activeTab" @update:value="activeTab = $event">
        <TabsList class="w-full justify-start border-b rounded-none bg-transparent p-0">
          <TabsTrigger
            v-for="tab in tabs"
            :key="tab.key"
            :value="tab.key"
            class="flex items-center px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <component :is="tab.icon" class="w-5 h-5 mr-2" />
            {{ tab.label }}
            <Badge v-if="tab.count !== undefined" variant="secondary" class="ml-2">
              {{ tab.count }}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </Card>

    <!-- 标签页内容 -->
    <Card>
      <CardContent class="p-6">
        <!-- 概览标签页 -->
        <ProjectOverview 
          v-if="activeTab === 'overview'" 
          :project-id="Number(route.params.id)"
        />

        <!-- 环境标签页 -->
        <ProjectEnvironments 
          v-else-if="activeTab === 'environments'" 
          :project-id="Number(route.params.id)"
        />

        <!-- 部署标签页 -->
        <ProjectDeployments 
          v-else-if="activeTab === 'deployments'" 
          :project-id="Number(route.params.id)"
        />

        <!-- 设置标签页 -->
        <ProjectSettings 
          v-else-if="activeTab === 'settings'" 
          :project-id="Number(route.params.id)"
        />
      </CardContent>
    </Card>

    <!-- 编辑项目模态框 -->
    <EditProjectModal
      v-if="showEditModal && project"
      :project="project"
      @close="showEditModal = false"
      @updated="onProjectUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { trpc, type AppRouter } from '@/lib/trpc'
import { Card, CardContent } from '@juanie/ui'
import { Button } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Avatar, AvatarImage, AvatarFallback } from '@juanie/ui'
import { Tabs, TabsList, TabsTrigger } from '@juanie/ui'
import { 
  Folder, Globe, Lock, GitBranch, User, Clock, Edit, Plus,
  BarChart3, Server, Zap, Settings
} from 'lucide-vue-next'
import EditProjectModal from '@/components/EditProjectModal.vue'
import ProjectOverview from '@/components/ProjectOverview.vue'
import ProjectEnvironments from '@/components/ProjectEnvironments.vue'
import ProjectDeployments from '@/components/ProjectDeployments.vue'
import ProjectSettings from '@/components/ProjectSettings.vue'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const route = useRoute()
const router = useRouter()

type ProjectWithDetails = Awaited<ReturnType<typeof trpc.projects.getById.query>>
const project = ref<ProjectWithDetails>(null)
const loading = ref(false)
const activeTab = ref('overview')
const showEditModal = ref(false)

// 标签页配置
const tabs = computed(() => [
  {
    key: 'overview',
    label: '概览',
    icon: BarChart3
  },
  {
    key: 'environments',
    label: '环境',
    count: project.value?.environmentsCount || 0,
    icon: Server
  },
  {
    key: 'deployments',
    label: '部署',
    count: project.value?.deploymentsCount || 0,
    icon: Zap
  },
  {
    key: 'settings',
    label: '设置',
    icon: Settings
  }
])

// 权限检查
const canEdit = computed(() => {
  // 这里应该检查用户是否有编辑权限
  return true
})

// 格式化时间
const formatTime = (dateString: string) => {
  if (!dateString) return ''
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: zhCN
  })
}

// 加载项目详情
const loadProject = async () => {
  try {
    loading.value = true
    const projectId = Number(route.params.id)
    
    if (isNaN(projectId)) {
      router.push('/projects')
      return
    }
    
    project.value = await trpc.projects.getById.query({ id: projectId })
  } catch (error) {
    console.error('加载项目失败:', error)
    // 可以显示错误提示或重定向
    router.push('/projects')
  } finally {
    loading.value = false
  }
}

const onProjectUpdated = () => {
  showEditModal.value = false
  loadProject()
}

// 生命周期
onMounted(() => {
  loadProject()
})
</script>