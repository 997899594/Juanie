<template>
  <div class="w-full">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-semibold">创建新项目</h2>
          <p class="text-sm text-muted-foreground mt-1">通过向导快速创建生产可用的项目</p>
        </div>
        <Badge variant="outline">步骤 {{ currentStep + 1 }} / {{ steps.length }}</Badge>
      </div>

      <div>
        <!-- 步骤指示器 -->
        <div class="mb-8">
          <div class="flex items-center justify-between relative">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="flex flex-col items-center flex-1"
            >
              <!-- 步骤圆圈 -->
              <div class="relative z-10 flex flex-col items-center">
                <button
                  :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all font-semibold',
                    index < currentStep
                      ? 'bg-primary border-primary text-primary-foreground'
                      : index === currentStep
                      ? 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-background border-border text-muted-foreground',
                    index < currentStep && 'cursor-pointer hover:bg-primary/90'
                  ]"
                  :disabled="index > currentStep"
                  @click="index < currentStep && (currentStep = index)"
                >
                  <CheckCircle2 v-if="index < currentStep" class="h-5 w-5" />
                  <span v-else>{{ index + 1 }}</span>
                </button>
                <div class="mt-3 text-center">
                  <div
                    :class="[
                      'text-sm font-medium',
                      index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                    ]"
                  >
                    {{ step.title }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-0.5">
                    {{ step.description }}
                  </div>
                </div>
              </div>
              
              <!-- 连接线 -->
              <div
                v-if="index < steps.length - 1"
                :class="[
                  'absolute top-5 h-0.5 transition-all',
                  index < currentStep ? 'bg-primary' : 'bg-border'
                ]"
                :style="{
                  left: `calc(${(index + 0.5) / steps.length * 100}% + 20px)`,
                  right: `calc(${(steps.length - index - 1.5) / steps.length * 100}% + 20px)`
                }"
              />
            </div>
          </div>
        </div>

        <!-- 步骤内容 -->
        <div class="min-h-[500px]">
          <!-- 步骤 1: 基本信息 -->
          <div v-if="currentStep === 0" class="space-y-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <Label for="project-name">项目名称 *</Label>
                <Input
                  id="project-name"
                  v-model="formData.name"
                  placeholder="例如：电商前端"
                  @input="generateSlug"
                />
              </div>

              <div class="space-y-2">
                <Label for="project-slug">
                  项目标识 *
                  <span class="text-xs text-muted-foreground font-normal ml-2">
                    (自动生成，可修改)
                  </span>
                </Label>
                <Input
                  id="project-slug"
                  v-model="formData.slug"
                  placeholder="例如：ecommerce-frontend"
                  @blur="validateSlug"
                />
                <p class="text-xs text-muted-foreground">
                  只能包含小写字母、数字和连字符，用于 URL 和资源命名
                </p>
              </div>

              <div class="space-y-2">
                <Label for="project-description">项目描述</Label>
                <Textarea
                  id="project-description"
                  v-model="formData.description"
                  placeholder="简单描述您的项目..."
                  rows="3"
                />
              </div>

              <div class="space-y-2">
                <Label for="project-visibility">可见性</Label>
                <Select v-model="formData.visibility">
                  <SelectTrigger id="project-visibility">
                    <SelectValue placeholder="选择可见性" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">私有 - 仅团队成员可见</SelectItem>
                    <SelectItem value="internal">内部 - 组织内可见</SelectItem>
                    <SelectItem value="public">公开 - 所有人可见</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <!-- 步骤 2: 模板选择 -->
          <div v-if="currentStep === 1">
            <TemplateSelector
              v-model="formData.templateId"
              @template-selected="handleTemplateSelected"
            />
          </div>

          <!-- 步骤 3: 仓库配置 -->
          <div v-if="currentStep === 2">
            <RepositoryConfig
              v-model="formData.repository"
              v-model:can-proceed="repositoryCanProceed"
              :project-name="formData.name"
              :template="selectedTemplate"
            />
          </div>

          <!-- 步骤 4: 确认创建 -->
          <div v-if="currentStep === 3">
            <!-- 进度显示 -->
            <div v-if="showProgress" class="mb-6 p-4 border rounded-lg bg-muted/50">
              <div class="flex items-center gap-3 mb-3">
                <Loader2 class="h-5 w-5 animate-spin text-primary" />
                <div class="flex-1">
                  <p class="text-sm font-medium">{{ progressMessage }}</p>
                  <p v-if="jobProgress" class="text-xs text-muted-foreground mt-1">
                    进度: {{ jobProgress.progress }}% - {{ jobProgress.state }}
                  </p>
                </div>
              </div>
              <Progress v-if="jobProgress" :value="jobProgress.progress" class="h-2" />
            </div>

            <div class="border rounded-lg divide-y">
              <!-- 基本信息 -->
              <div class="p-4 space-y-2">
                <h4 class="text-sm font-semibold mb-3">基本信息</h4>
                <div class="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span class="text-muted-foreground">项目名称</span>
                  <span class="font-medium truncate">{{ formData.name }}</span>
                  
                  <span class="text-muted-foreground">项目标识</span>
                  <span class="font-medium truncate">{{ formData.slug }}</span>
                  
                  <span class="text-muted-foreground">项目可见性</span>
                  <Badge class="w-fit">{{ visibilityLabel }}</Badge>
                </div>
              </div>

              <!-- 项目模板 -->
              <div class="p-4 space-y-2">
                <h4 class="text-sm font-semibold mb-3">项目模板</h4>
                <div v-if="selectedTemplate" class="text-sm">
                  <p class="font-medium">{{ selectedTemplate.name }}</p>
                  <p class="text-muted-foreground text-xs mt-1">{{ selectedTemplate.description }}</p>
                </div>
                <div v-else class="text-sm">
                  <p class="font-medium">空白项目</p>
                  <p class="text-muted-foreground text-xs mt-1">从零开始，手动配置所有内容</p>
                </div>
              </div>

              <!-- Git 仓库 -->
              <div v-if="formData.repository" class="p-4 space-y-2">
                <h4 class="text-sm font-semibold mb-3">Git 仓库</h4>
                <div class="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span class="text-muted-foreground">模式</span>
                  <span class="font-medium">
                    {{ formData.repository.mode === 'existing' ? '关联现有仓库' : '创建新仓库' }}
                  </span>
                  
                  <span class="text-muted-foreground">提供商</span>
                  <Badge class="w-fit">{{ formData.repository.provider }}</Badge>
                  
                  <template v-if="formData.repository.mode === 'existing'">
                    <span class="text-muted-foreground">仓库 URL</span>
                    <span class="font-medium text-xs truncate">{{ formData.repository.url }}</span>
                  </template>
                  <template v-else>
                    <span class="text-muted-foreground">仓库名称</span>
                    <span class="font-medium truncate">{{ formData.repository.name }}</span>
                  </template>
                </div>
              </div>

              <!-- 环境配置 -->
              <div class="p-4 space-y-2">
                <h4 class="text-sm font-semibold mb-3">环境配置</h4>
                <div class="text-sm">
                  <p class="text-muted-foreground">将创建 3 个默认环境：Development、Staging、Production</p>
                  <p class="text-xs text-muted-foreground mt-2">
                    💡 创建后可在项目设置中调整
                  </p>
                </div>
              </div>
            </div>
          </div>


        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            v-if="currentStep > 0"
            variant="outline"
            @click="handlePrevious"
            :disabled="loading"
          >
            <ChevronLeft class="mr-2 h-4 w-4" />
            上一步
          </Button>
          <div v-else />

          <div class="flex gap-2">
            <Button
              v-if="currentStep < 3"
              variant="outline"
              @click="handleCancel"
              :disabled="loading"
            >
              取消
            </Button>
            <Button
              v-if="currentStep < 3"
              @click="handleNext"
              :disabled="!canProceed || loading"
            >
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              下一步
              <ChevronRight class="ml-2 h-4 w-4" />
            </Button>
            <Button
              v-else-if="currentStep === 3"
              @click="handleCreateProject"
              :disabled="loading || showProgress"
            >
              <Loader2 v-if="loading || showProgress" class="mr-2 h-4 w-4 animate-spin" />
              {{ showProgress ? '创建中...' : '创建项目' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  Badge,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@juanie/ui'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-vue-next'
import TemplateSelector from './TemplateSelector.vue'
import RepositoryConfig from './RepositoryConfig.vue'
import { useProjects } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useJobProgress } from '@/composables/useJobProgress'

const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const { createProject } = useProjects()
const { progress: jobProgress, connect: connectToJob, disconnect: disconnectJob } = useJobProgress()

const emit = defineEmits<{
  close: []
}>()

// 步骤定义 - 简化为 4 步
const steps = [
  { id: 'basic', title: '基本信息', description: '项目名称和描述' },
  { id: 'template', title: '选择模板', description: '选择技术栈模板' },
  { id: 'repository', title: 'Git 仓库', description: '关联或创建仓库' },
  { id: 'confirm', title: '确认创建', description: '检查并创建' },
]

const currentStep = ref(0)
const loading = ref(false)
const createdProjectId = ref<string | null>(null)
const repositoryCanProceed = ref(false)
const showProgress = ref(false)
const progressMessage = ref('')

// 监听任务进度
watch(jobProgress, (newProgress) => {
  if (newProgress) {
    progressMessage.value = newProgress.logs[newProgress.logs.length - 1] || '处理中...'
  }
})

// 表单数据
const formData = ref({
  name: '',
  slug: '',
  description: '',
  visibility: 'private' as 'private' | 'internal' | 'public',
  templateId: null as string | null,
  templateConfig: {} as Record<string, any>,
  repository: null as (
    | {
        mode: 'existing'
        provider: 'github' | 'gitlab'
        url: string
        accessToken: string
        defaultBranch?: string
      }
    | {
        mode: 'create'
        provider: 'github' | 'gitlab'
        name: string
        accessToken: string
        visibility: 'public' | 'private'
        defaultBranch?: string
        includeAppCode?: boolean
      }
  ) | null,
})

const selectedTemplate = ref<any>(null)

// 默认环境配置（当没有选择模板时使用）
const defaultEnvironments = [
  {
    name: 'Development',
    type: 'development',
    description: '开发环境 - 用于日常开发和测试'
  },
  {
    name: 'Staging',
    type: 'staging',
    description: '预发布环境 - 用于上线前验证'
  },
  {
    name: 'Production',
    type: 'production',
    description: '生产环境 - 正式对外服务'
  }
]

// 计算属性
const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0:
      return !!(formData.value.name && formData.value.slug)
    case 1:
      return true // 模板是可选的
    case 2:
      return repositoryCanProceed.value // 仓库也是可选的
    case 3:
      return true
    default:
      return false
  }
})

const visibilityLabel = computed(() => {
  const labels = {
    private: '私有',
    internal: '内部',
    public: '公开',
  }
  return labels[formData.value.visibility]
})

// 自动生成 slug（只在 slug 为空或未被用户手动修改时生成）
const slugManuallyEdited = ref(false)

function generateSlug() {
  // 如果用户手动编辑过 slug，就不再自动生成
  if (slugManuallyEdited.value) return
  
  formData.value.slug = formData.value.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// 验证并格式化 slug
function validateSlug() {
  slugManuallyEdited.value = true
  formData.value.slug = formData.value.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 处理模板选择
function handleTemplateSelected(template: any) {
  selectedTemplate.value = template
}

// 导航
function handleNext() {
  if (canProceed.value) {
    currentStep.value++
  }
}

function handlePrevious() {
  currentStep.value--
}

function handleCancel() {
  emit('close')
}

// 创建项目
async function handleCreateProject() {
  loading.value = true

  try {
    // 构建项目数据
    const projectData = {
      organizationId: appStore.currentOrganizationId!,
      name: formData.value.name,
      slug: formData.value.slug,
      description: formData.value.description,
      visibility: formData.value.visibility,
      templateId: formData.value.templateId || undefined,
      templateConfig: formData.value.templateConfig || undefined,
      repository: formData.value.repository || undefined,
    }

    // 验证数据
    if (!projectData.name || !projectData.slug) {
      toast.error('验证失败', '请填写项目名称和标识')
      return
    }

    // 如果有仓库配置，验证必填字段
    if (projectData.repository) {
      if (projectData.repository.mode === 'existing' && !projectData.repository.url) {
        toast.error('验证失败', '请输入仓库 URL')
        return
      }
      if (projectData.repository.mode === 'create' && !projectData.repository.name) {
        toast.error('验证失败', '请输入仓库名称')
        return
      }
      if (!projectData.repository.accessToken) {
        toast.error('验证失败', '请提供访问令牌或连接 OAuth 账户')
        return
      }
    }

    const { project, jobIds } = await createProject(projectData)
    createdProjectId.value = project.id

    // 如果有异步任务（创建仓库），显示进度
    if (jobIds && jobIds.length > 0 && projectData.repository?.mode === 'create') {
      showProgress.value = true
      progressMessage.value = '正在创建仓库...'
      
      // 连接到第一个任务的 SSE 流
      const firstJobId = jobIds[0]
      if (firstJobId) {
        connectToJob(firstJobId)
      }
      
      // 等待一段时间后关闭弹窗并跳转
      setTimeout(() => {
        emit('close')
        router.push(`/projects/${project.id}`)
      }, 2000)
    } else {
      toast.success('项目创建成功', '正在初始化项目资源，请稍候...')
      
      // 关闭弹窗
      emit('close')
      
      // 跳转到项目详情页
      router.push(`/projects/${project.id}`)
    }
  } catch (error: any) {
    // 错误已经在 useProjects 中通过 toast 显示
    console.error('Project creation failed:', error)
  } finally {
    loading.value = false
  }
}
</script>
