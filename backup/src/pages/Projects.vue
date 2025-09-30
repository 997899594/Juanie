<template>
  <div class="projects-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1>项目管理</h1>
        <p>管理您的DevOps项目，集成GitHub/GitLab仓库</p>
      </div>
      <div class="header-actions">
        <n-button @click="refreshProjects">
          <template #icon>
            <RefreshCw class="w-4 h-4" />
          </template>
          刷新
        </n-button>
        <n-button type="primary" @click="showCreateModal = true">
          <template #icon>
            <Plus class="w-4 h-4" />
          </template>
          创建项目
        </n-button>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="filters-section">
      <div class="search-bar">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索项目名称、描述或技术栈..."
          clearable
        >
          <template #prefix>
            <Search class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </div>
      <div class="filters">
        <n-select
          v-model:value="statusFilter"
          placeholder="项目状态"
          :options="statusOptions"
          clearable
          style="width: 150px"
        />
        <n-select
          v-model:value="techStackFilter"
          placeholder="技术栈"
          :options="techStackOptions"
          clearable
          style="width: 150px"
        />
        <n-button @click="resetFilters" quaternary>
          <template #icon>
            <X class="w-4 h-4" />
          </template>
          重置
        </n-button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
      <p>加载项目列表中...</p>
    </div>

    <!-- Projects Grid -->
    <div class="projects-grid" v-else-if="filteredProjects.length > 0">
      <div 
        v-for="project in filteredProjects" 
        :key="project.id"
        class="project-card"
        @click="viewProject(project.id)"
      >
        <div class="project-header">
          <div class="project-avatar">
            <component :is="getProjectIcon(project.repository)" class="w-6 h-6" />
          </div>
          <div class="project-status" :class="project.status.toLowerCase()">
            {{ getStatusText(project.status) }}
          </div>
          <div class="project-actions" @click.stop>
            <n-dropdown :options="getProjectActions(project)" @select="handleProjectAction">
              <n-button size="small" quaternary circle>
                <template #icon>
                  <MoreHorizontal class="w-4 h-4" />
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>

        <div class="project-content">
          <h3 class="project-name">{{ project.name }}</h3>
          <p class="project-description">{{ project.description || '暂无描述' }}</p>
          
          <div class="project-meta">
            <div class="meta-item">
              <GitBranch class="w-4 h-4" />
              <span>main</span>
            </div>
            <div class="meta-item">
              <Calendar class="w-4 h-4" />
              <span>{{ formatDate(project.updatedAt) }}</span>
            </div>
            <div class="meta-item" v-if="project.repository">
              <ExternalLink class="w-4 h-4" />
              <span>{{ getRepoProvider(project.repository) }}</span>
            </div>
          </div>

          <div class="project-tech-stack" v-if="project.repository">
            <n-tag size="small" type="info">
              {{ project.repository.split('/').pop() }}
            </n-tag>
          </div>

          <div class="project-stats">
            <div class="stat-item">
              <span class="stat-value">0</span>
              <span class="stat-label">成员</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">0</span>
              <span class="stat-label">部署</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">0</span>
              <span class="stat-label">流水线</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading" class="empty-state">
      <div class="empty-icon">
        <Folder class="w-16 h-16 text-slate-400" />
      </div>
      <h3>暂无项目</h3>
      <p>创建您的第一个DevOps项目开始使用</p>
      <n-button type="primary" @click="showCreateModal = true">
        <template #icon>
          <Plus class="w-4 h-4" />
        </template>
        创建项目
      </n-button>
    </div>

    <!-- Create Project Modal -->
    <n-modal v-model:show="showCreateModal" preset="card" title="创建项目" style="width: 600px">
      <CreateProjectForm @success="handleCreateSuccess" @cancel="showCreateModal = false" />
    </n-modal>

    <!-- Edit Project Modal -->
    <n-modal v-model:show="showEditModal" preset="card" title="编辑项目" style="width: 600px">
      <EditProjectForm 
        v-if="selectedProject"
        :project="selectedProject"
        @success="handleEditSuccess" 
        @cancel="showEditModal = false" 
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  NButton, 
  NInput, 
  NSelect, 
  NTag, 
  NModal, 
  NDropdown,
  useMessage,
  type DropdownOption
} from 'naive-ui'
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  GitBranch,
  Users,
  Activity,
  Calendar,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Settings,
  Play,
  Pause,
  Archive,
  X,
  ExternalLink,
  Folder,
  Code,
  Database,
  Globe,
  Smartphone,
  Server
} from 'lucide-vue-next'
import CreateProjectForm from '@/components/projects/CreateProjectForm.vue'
import EditProjectForm from '@/components/projects/EditProjectForm.vue'
import { getProjects, deleteProject as deleteProjectApi, type Project } from '@/api/projects'

const router = useRouter()
const message = useMessage()

// State
const searchQuery = ref('')
const statusFilter = ref(null)
const techStackFilter = ref(null)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const selectedProject = ref(null)
const loading = ref(false)

// 项目数据
const projects = ref<Project[]>([])

// Options
const statusOptions = [
  { label: '活跃', value: 'ACTIVE' },
  { label: '部署中', value: 'DEPLOYING' },
  { label: '维护中', value: 'MAINTENANCE' },
  { label: '已暂停', value: 'PAUSED' }
]

const techStackOptions = [
  { label: 'React', value: 'React' },
  { label: 'Vue.js', value: 'Vue.js' },
  { label: 'Node.js', value: 'Node.js' },
  { label: 'NestJS', value: 'NestJS' },
  { label: 'Python', value: 'Python' },
  { label: 'PostgreSQL', value: 'PostgreSQL' },
  { label: 'MongoDB', value: 'MongoDB' },
  { label: 'Redis', value: 'Redis' },
  { label: 'Docker', value: 'Docker' }
]

// Computed
const filteredProjects = computed(() => {
  let filtered = projects.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(project => 
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.repository?.toLowerCase().includes(query)
    )
  }

  // Status filter
  if (statusFilter.value) {
    filtered = filtered.filter(project => project.status === statusFilter.value)
  }

  // Tech stack filter
  if (techStackFilter.value) {
    filtered = filtered.filter(project => 
      project.repository?.includes(techStackFilter.value) // 临时使用repository字段
    )
  }

  return filtered
})

// Methods
const getProjectIcon = (repository?: string) => {
  if (!repository) return Folder
  if (repository.includes('react') || repository.includes('vue')) return Code
  if (repository.includes('api') || repository.includes('backend')) return Server
  return Globe
}

const getStatusText = (status: string) => {
  const statusMap = {
    'ACTIVE': '活跃',
    'DEPLOYING': '部署中',
    'MAINTENANCE': '维护中',
    'PAUSED': '已暂停'
  }
  return statusMap[status] || status
}

const getTechColor = (tech: string) => {
  const colorMap = {
    'React': { color: '#61dafb', textColor: '#000' },
    'Vue.js': { color: '#4fc08d', textColor: '#fff' },
    'Node.js': { color: '#339933', textColor: '#fff' },
    'NestJS': { color: '#e0234e', textColor: '#fff' },
    'Python': { color: '#3776ab', textColor: '#fff' },
    'PostgreSQL': { color: '#336791', textColor: '#fff' },
    'MongoDB': { color: '#47a248', textColor: '#fff' },
    'Redis': { color: '#dc382d', textColor: '#fff' },
    'Docker': { color: '#2496ed', textColor: '#fff' },
    'ClickHouse': { color: '#ffcc02', textColor: '#000' }
  }
  return colorMap[tech] || { color: '#6b7280', textColor: '#fff' }
}

const getRepoProvider = (url: string) => {
  if (url.includes('github.com')) return 'GitHub'
  if (url.includes('gitlab.com')) return 'GitLab'
  return 'Git'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return date.toLocaleDateString('zh-CN')
}

const getProjectActions = (project: any): DropdownOption[] => [
  {
    label: '查看详情',
    key: 'view',
    icon: () => h(Code, { class: 'w-4 h-4' }),
    props: {
      onClick: () => viewProject(project.id)
    }
  },
  {
    label: '编辑项目',
    key: 'edit',
    icon: () => h(Edit, { class: 'w-4 h-4' }),
    props: {
      onClick: () => editProject(project)
    }
  },
  {
    label: '成员管理',
    key: 'members',
    icon: () => h(Users, { class: 'w-4 h-4' }),
    props: {
      onClick: () => manageMembers(project.id)
    }
  },
  {
    label: '项目设置',
    key: 'settings',
    icon: () => h(Settings, { class: 'w-4 h-4' }),
    props: {
      onClick: () => projectSettings(project.id)
    }
  },
  {
    type: 'divider'
  },
  {
    label: '删除项目',
    key: 'delete',
    icon: () => h(Trash2, { class: 'w-4 h-4' }),
    props: {
      onClick: () => deleteProject(project.id),
      style: 'color: #ef4444'
    }
  }
]

const viewProject = (id: string) => {
  router.push(`/projects/${id}`)
}

const editProject = (project: any) => {
  selectedProject.value = project
  showEditModal.value = true
}

const manageMembers = (id: string) => {
  router.push(`/projects/${id}/members`)
}

const projectSettings = (id: string) => {
  router.push(`/projects/${id}/settings`)
}

// 加载项目列表
const loadProjects = async () => {
  try {
    loading.value = true
    projects.value = await getProjects()
  } catch (error) {
    console.error('Failed to load projects:', error)
    message.error('加载项目列表失败')
  } finally {
    loading.value = false
  }
}

const deleteProject = async (id: string) => {
  try {
    await deleteProjectApi(id)
    message.success('项目删除成功')
    await loadProjects()
  } catch (error) {
    console.error('Failed to delete project:', error)
    message.error('删除项目失败')
  }
}

const handleProjectAction = (key: string) => {
  // Actions are handled in the dropdown options
}

const refreshProjects = async () => {
  await loadProjects()
  message.success('项目列表已刷新')
}

const resetFilters = () => {
  searchQuery.value = ''
  statusFilter.value = null
  techStackFilter.value = null
}

const handleCreateSuccess = async () => {
  showCreateModal.value = false
  await loadProjects()
}

const handleEditSuccess = async () => {
  showEditModal.value = false
  selectedProject.value = null
  await loadProjects()
}

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.projects-page {
  @apply space-y-6;
}

/* Page Header */
.page-header {
  @apply flex items-center justify-between;
}

.header-content h1 {
  @apply text-2xl font-bold text-white mb-2;
}

.header-content p {
  @apply text-slate-400;
}

.header-actions {
  @apply flex gap-3;
}

/* Filters Section */
.filters-section {
  @apply flex items-center justify-between gap-4 p-4 rounded-xl;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.search-bar {
  @apply flex-1 max-w-md;
}

.filters {
  @apply flex items-center gap-3;
}

/* Projects Grid */
.projects-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6;
}

.project-card {
  @apply p-6 rounded-2xl border cursor-pointer transition-all duration-200;
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.1);
}

.project-card:hover {
  @apply transform scale-105;
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(59, 130, 246, 0.3);
}

.project-header {
  @apply flex items-center justify-between mb-4;
}

.project-avatar {
  @apply w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300;
}

.project-status {
  @apply px-2 py-1 rounded-full text-xs font-medium;
}

.project-status.active {
  @apply bg-green-600 text-green-100;
}

.project-status.deploying {
  @apply bg-blue-600 text-blue-100;
}

.project-status.maintenance {
  @apply bg-yellow-600 text-yellow-100;
}

.project-status.paused {
  @apply bg-gray-600 text-gray-100;
}

.project-content {
  @apply space-y-4;
}

.project-name {
  @apply text-lg font-semibold text-white;
}

.project-description {
  @apply text-sm text-slate-400 line-clamp-2;
}

.project-meta {
  @apply flex items-center gap-4 text-sm text-slate-400;
}

.meta-item {
  @apply flex items-center gap-1;
}

.project-tech-stack {
  @apply flex flex-wrap gap-2;
}

.project-stats {
  @apply flex items-center justify-between pt-4 border-t border-slate-700;
}

.stat-item {
  @apply text-center;
}

.stat-value {
  @apply block text-lg font-semibold text-white;
}

.stat-label {
  @apply text-xs text-slate-400;
}

/* Empty State */
.empty-state {
  @apply text-center py-16;
}

.empty-icon {
  @apply flex justify-center mb-4;
}

.empty-state h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.empty-state p {
  @apply text-slate-400 mb-6;
}

/* Form Overrides */
:deep(.n-input) {
  @apply bg-slate-700 border-slate-600;
}

:deep(.n-input:hover) {
  @apply border-slate-500;
}

:deep(.n-input.n-input--focus) {
  @apply border-blue-500;
}

:deep(.n-input__input-el) {
  @apply text-white placeholder-slate-400;
}

:deep(.n-select) {
  @apply bg-slate-700;
}

:deep(.n-base-selection) {
  @apply bg-slate-700 border-slate-600;
}

:deep(.n-base-selection:hover) {
  @apply border-slate-500;
}

:deep(.n-base-selection.n-base-selection--focus) {
  @apply border-blue-500;
}

:deep(.n-base-selection-label) {
  @apply text-white;
}

:deep(.n-base-selection-placeholder) {
  @apply text-slate-400;
}

:deep(.n-button--primary-type) {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border: none;
}

:deep(.n-button--primary-type:hover) {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
}
</style>