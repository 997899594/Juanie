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
          <div v-if="currentStep === 3" class="space-y-6">
            <div class="text-center space-y-4">
              <div class="flex justify-center">
                <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 class="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 class="text-xl font-semibold">确认项目配置</h3>
              <p class="text-muted-foreground">
                请检查以下配置，确认无误后点击"创建项目"
              </p>
            </div>

            <div class="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle class="text-base">基本信息</CardTitle>
                </CardHeader>
                <CardContent class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">项目名称:</span>
                    <span class="font-medium">{{ formData.name }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">项目标识:</span>
                    <span class="font-medium">{{ formData.slug }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">可见性:</span>
                    <Badge>{{ visibilityLabel }}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="text-base">项目模板</CardTitle>
                </CardHeader>
                <CardContent>
                  <div v-if="selectedTemplate" class="flex items-start space-x-3">
                    <div class="flex-1">
                      <h4 class="font-semibold">{{ selectedTemplate.name }}</h4>
                      <p class="text-sm text-muted-foreground">{{ selectedTemplate.description }}</p>
                      <div class="flex flex-wrap gap-1 mt-2">
                        <Badge
                          v-for="tech in selectedTemplate.techStack"
                          :key="tech"
                          variant="outline"
                          class="text-xs"
                        >
                          {{ tech }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div v-else class="flex items-start space-x-3">
                    <div class="flex-1">
                      <h4 class="font-semibold">空白项目</h4>
                      <p class="text-sm text-muted-foreground">从零开始，手动配置所有内容</p>
                      <div class="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" class="text-xs">
                          自定义配置
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card v-if="formData.repository">
                <CardHeader>
                  <CardTitle class="text-base">Git 仓库</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">模式:</span>
                      <span class="font-medium">
                        {{ formData.repository.mode === 'existing' ? '关联现有仓库' : '创建新仓库' }}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">提供商:</span>
                      <Badge>{{ formData.repository.provider }}</Badge>
                    </div>
                    <div v-if="formData.repository.mode === 'existing'" class="flex justify-between">
                      <span class="text-muted-foreground">仓库 URL:</span>
                      <span class="font-medium text-sm">{{ formData.repository.url }}</span>
                    </div>
                    <div v-else class="flex justify-between">
                      <span class="text-muted-foreground">仓库名称:</span>
                      <span class="font-medium">{{ formData.repository.name }}</span>
                    </div>
                    <div v-if="formData.repository.mode === 'create' && formData.repository.includeAppCode" class="flex justify-between">
                      <span class="text-muted-foreground">包含代码模板:</span>
                      <Badge variant="outline">是</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="text-base">环境配置</CardTitle>
                  <CardDescription class="text-xs">
                    {{ selectedTemplate ? '系统将根据模板自动创建 3 个环境' : '系统将创建默认的 3 个环境' }}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div v-if="selectedTemplate && selectedTemplate.defaultConfig?.environments" class="space-y-3">
                    <div
                      v-for="env in selectedTemplate.defaultConfig.environments"
                      :key="env.type"
                      class="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div class="font-medium">{{ env.name }}</div>
                        <div class="text-sm text-muted-foreground">
                          副本数: {{ env.replicas }} | CPU: {{ env.resources.requests.cpu }} | 内存: {{ env.resources.requests.memory }}
                        </div>
                      </div>
                      <Badge>{{ env.type }}</Badge>
                    </div>
                  </div>
                  <div v-else class="space-y-3">
                    <div
                      v-for="env in defaultEnvironments"
                      :key="env.type"
                      class="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div class="font-medium">{{ env.name }}</div>
                        <div class="text-sm text-muted-foreground">
                          {{ env.description }}
                        </div>
                      </div>
                      <Badge>{{ env.type }}</Badge>
                    </div>
                  </div>
                  <p class="text-xs text-muted-foreground mt-3">
                    💡 创建后可在项目设置中调整环境配置
                  </p>
                </CardContent>
              </Card>
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
              :disabled="loading"
            >
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              创建项目
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
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

const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const { createProject } = useProjects()

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

// 表单数据
const formData = ref({
  name: '',
  slug: '',
  description: '',
  visibility: 'private' as 'private' | 'internal' | 'public',
  templateId: null as string | null,
  templateConfig: {} as Record<string, any>,
  repository: null as {
    mode: 'existing' | 'create'
    provider: 'github' | 'gitlab'
    url?: string
    name?: string
    accessToken: string
    visibility?: 'public' | 'private'
    defaultBranch?: string
    includeAppCode?: boolean
  } | null,
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
    const projectData = {
      organizationId: appStore.currentOrganizationId!,
      name: formData.value.name,
      slug: formData.value.slug,
      description: formData.value.description,
      visibility: formData.value.visibility,
      templateId: formData.value.templateId || undefined,
      templateConfig: formData.value.templateConfig,
      repository: formData.value.repository || undefined,
    }

    const project = await createProject(projectData)
    createdProjectId.value = project.id

    toast.success('项目创建成功', '正在初始化项目资源，请稍候...')
    
    // 关闭弹窗
    emit('close')
    
    // 跳转到项目详情页，显示初始化进度
    router.push(`/projects/${project.id}`)
  } catch (error: any) {
    toast.error('创建失败', error.message)
  } finally {
    loading.value = false
  }
}
</script>
