<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- 页面头部 -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
      <div class="mb-4 sm:mb-0">
        <h1 class="text-3xl font-bold text-foreground mb-2">项目管理</h1>
        <p class="text-muted-foreground">管理您的所有项目，查看项目状态和部署信息</p>
      </div>
      <div class="flex items-center space-x-3">
        <Button @click="showCreateModal = true">
          <Plus class="w-4 h-4 mr-2" />
          新建项目
        </Button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="搜索项目..."
          class="pl-10"
          @input="debouncedSearch"
        />
      </div>
      <Tabs :value="activeFilter" @update:value="activeFilter = $event" class="w-auto">
        <TabsList>
          <TabsTrigger
            v-for="tab in filterTabs"
            :key="tab.value"
            :value="tab.value"
          >
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- 项目列表 -->
    <div v-if="!loading && projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <ProjectCard
        v-for="project in filteredProjects"
        :key="project.id"
        :project="project"
        @click="goToProject(project.id)"
        @edit="editProject"
        @delete="deleteProject"
      />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!loading && projects.length === 0" class="text-center py-12">
      <div class="flex justify-center mb-4">
        <FolderOpen class="w-16 h-16 text-muted-foreground" />
      </div>
      <h3 class="text-xl font-semibold text-foreground mb-2">还没有项目</h3>
      <p class="text-muted-foreground mb-4">创建您的第一个项目来开始管理部署和环境</p>
      <Button @click="showCreateModal = true">
        创建项目
      </Button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <div class="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mb-4"></div>
      <p class="text-muted-foreground">加载项目中...</p>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-center space-x-4">
      <Button
        variant="outline"
        :disabled="currentPage === 1"
        @click="currentPage--"
      >
        上一页
      </Button>
      <span class="text-sm text-muted-foreground">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页
      </span>
      <Button
        variant="outline"
        :disabled="currentPage === totalPages"
        @click="currentPage++"
      >
        下一页
      </Button>
    </div>

    <!-- 创建项目模态框 -->
    <CreateProjectModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onProjectCreated"
    />

    <!-- 编辑项目模态框 -->
    <EditProjectModal
      v-if="showEditModal && editingProject"
      :project="editingProject"
      @close="showEditModal = false"
      @updated="onProjectUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { trpc, type AppRouter } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@juanie/ui'
import { Input } from '@juanie/ui'
import { Tabs, TabsList, TabsTrigger } from '@juanie/ui'
import { Plus, Search, FolderOpen } from 'lucide-vue-next'
import ProjectCard from '@/components/ProjectCard.vue'
import CreateProjectModal from '@/components/CreateProjectModal.vue'
import EditProjectModal from '@/components/EditProjectModal.vue'
import { debounce } from 'lodash-es'

const router = useRouter()
const authStore = useAuthStore()

// 响应式数据
const loading = ref(false)
type ProjectListResult = Awaited<ReturnType<typeof trpc.projects.list.query>>
const projects = ref<ProjectListResult['projects']>([])
const searchQuery = ref('')
const activeFilter = ref('all')
const currentPage = ref(1)
const pageSize = 20
const totalProjects = ref(0)
const showCreateModal = ref(false)
const showEditModal = ref(false)
type ProjectWithDetails = ProjectListResult['projects'][0]
const editingProject = ref<ProjectWithDetails | null>(null)

// 筛选选项
const filterTabs = [
  { label: '全部', value: 'all' },
  { label: '我的项目', value: 'owned' },
  { label: '公开项目', value: 'public' },
]

// 计算属性
const totalPages = computed(() => Math.ceil(totalProjects.value / pageSize))

const filteredProjects = computed(() => {
  let filtered = projects.value

  // 根据筛选条件过滤
  if (activeFilter.value === 'owned') {
    // 根据当前用户ID过滤，检查是否是项目所有者
    filtered = filtered.filter((project: ProjectListResult['projects'][0]) => 
      project.ownerId === Number(authStore.user?.id)
    )
  } else if (activeFilter.value === 'public') {
    filtered = filtered.filter((project: ProjectListResult['projects'][0]) => project.isPublic)
  }

  return filtered
})

// 防抖搜索
const debouncedSearch = debounce(() => {
  currentPage.value = 1
  loadProjects()
}, 300)

// 方法
const loadProjects = async () => {
  try {
    loading.value = true
    const result = await trpc.projects.list.query({
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize,
      search: searchQuery.value || undefined,
      isPublic: activeFilter.value === 'public' ? true : undefined,
    })
    
    projects.value = result.projects
    totalProjects.value = result.total
  } catch (error) {
    console.error('加载项目失败:', error)
    // 这里可以添加错误提示
  } finally {
    loading.value = false
  }
}

const goToProject = (projectId: number) => {
  router.push(`/projects/${projectId}`)
}

const editProject = (project: ProjectWithDetails) => {
  editingProject.value = project
  showEditModal.value = true
}

const deleteProject = async (project: ProjectWithDetails) => {
  if (!confirm(`确定要删除项目 "${project.name}" 吗？此操作不可恢复。`)) {
    return
  }

  try {
    await trpc.projects.delete.mutate({ id: project.id })
    await loadProjects()
    // 显示成功提示
  } catch (error) {
    console.error('删除项目失败:', error)
    // 显示错误提示
  }
}

const onProjectCreated = () => {
  showCreateModal.value = false
  loadProjects()
}

const onProjectUpdated = () => {
  showEditModal.value = false
  editingProject.value = null
  loadProjects()
}

// 监听器
watch([currentPage, activeFilter], () => {
  loadProjects()
})

// 生命周期
onMounted(() => {
  loadProjects()
})
</script>