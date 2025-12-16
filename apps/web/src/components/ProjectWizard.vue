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
                <Label for="name">项目名称 *</Label>
                <Input
                  id="name"
                  v-model="name"
                  v-bind="nameAttrs"
                  placeholder="例如：电商前端"
                  @input="generateSlug"
                />
                <p v-if="errors.name" class="text-sm text-destructive">
                  {{ errors.name }}
                </p>
              </div>

              <div class="space-y-2">
                <Label for="slug">
                  项目标识 *
                  <span class="text-xs text-muted-foreground font-normal ml-2">
                    (自动生成，可修改)
                  </span>
                </Label>
                <Input
                  id="slug"
                  v-model="slug"
                  v-bind="slugAttrs"
                  placeholder="例如：ecommerce-frontend"
                  @blur="validateSlug"
                />
                <p class="text-sm text-muted-foreground">
                  只能包含小写字母、数字和连字符，用于 URL 和资源命名
                </p>
                <p v-if="errors.slug" class="text-sm text-destructive">
                  {{ errors.slug }}
                </p>
              </div>

              <div class="space-y-2">
                <Label for="description">项目描述</Label>
                <Textarea
                  id="description"
                  v-model="description"
                  v-bind="descriptionAttrs"
                  placeholder="简单描述您的项目..."
                  rows="3"
                />
                <p v-if="errors.description" class="text-sm text-destructive">
                  {{ errors.description }}
                </p>
              </div>

              <div class="space-y-2">
                <Label for="visibility">可见性</Label>
                <Select v-model="visibility">
                  <SelectTrigger id="visibility">
                    <SelectValue placeholder="选择可见性" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">私有 - 仅团队成员可见</SelectItem>
                    <SelectItem value="internal">内部 - 组织内可见</SelectItem>
                    <SelectItem value="public">公开 - 所有人可见</SelectItem>
                  </SelectContent>
                </Select>
                <p v-if="errors.visibility" class="text-sm text-destructive">
                  {{ errors.visibility }}
                </p>
              </div>
            </div>
          </div>

          <!-- 步骤 2: 模板选择 -->
          <div v-if="currentStep === 1">
            <TemplateSelector
              :model-value="formData.templateId"
              @update:model-value="(val) => setFieldValue('templateId', val)"
              @template-selected="handleTemplateSelected"
            />
          </div>

          <!-- 步骤 3: 仓库配置 (必选) -->
          <div v-if="currentStep === 2">
            <div class="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <div class="flex gap-3">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h4 class="text-sm font-medium text-blue-900">Git 仓库是必需的</h4>
                  <p class="text-sm text-blue-700 mt-1">
                    为了实现 GitOps 自动化部署，每个项目都需要关联一个 Git 仓库。
                    你可以选择关联现有仓库或创建新仓库。
                  </p>
                </div>
              </div>
            </div>
            <RepositoryConfig
              :model-value="formData.repository"
              @update:model-value="(val) => setFieldValue('repository', val)"
              v-model:can-proceed="repositoryCanProceed"
              :project-name="formData.name"
              :template="selectedTemplate"
              :required="true"
            />
          </div>

          <!-- 步骤 4: 确认创建 -->
          <div v-if="currentStep === 3">
            <!-- 进度显示 -->
            <div v-if="showProgress" class="mb-6 p-4 border rounded-lg bg-muted/50">
              <div class="flex items-center gap-3">
                <Loader2 class="h-5 w-5 animate-spin text-primary" />
                <p class="text-sm font-medium">{{ progressMessage }}</p>
              </div>
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

              <!-- Git 仓库 (必选) -->
              <div class="p-4 space-y-2">
                <h4 class="text-sm font-semibold mb-3">Git 仓库</h4>
                <div v-if="formData.repository" class="grid grid-cols-[120px_1fr] gap-2 text-sm">
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
                  <template v-else-if="formData.repository.mode === 'create'">
                    <span class="text-muted-foreground">仓库名称</span>
                    <span class="font-medium truncate">{{ formData.repository.name }}</span>
                  </template>
                </div>
                <div v-else class="text-sm text-muted-foreground">
                  未配置 Git 仓库
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
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button,
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage , log } from '@juanie/ui'
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
  { id: 'repository', title: 'Git 仓库 *', description: '关联或创建仓库' },
  { id: 'confirm', title: '确认创建', description: '检查并创建' },
]

const currentStep = ref(0)
const loading = ref(false)
const createdProjectId = ref<string | null>(null)
const repositoryCanProceed = ref(false)
const showProgress = ref(false)
const progressMessage = ref('')
const selectedTemplate = ref<any>(null)

// 表单验证 schema
const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, '项目名称不能为空').max(255, '项目名称过长'),
    slug: z
      .string()
      .min(1, '项目标识不能为空')
      .max(255, '项目标识过长')
      .regex(/^[a-z0-9-]+$/, '只能包含小写字母、数字和连字符'),
    description: z.string().optional(),
    visibility: z.enum(['private', 'internal', 'public']),
    templateId: z.string().nullable().optional(),
    templateConfig: z.record(z.string(), z.any()).optional(),
    repository: z
      .discriminatedUnion('mode', [
        z.object({
          mode: z.literal('existing'),
          provider: z.enum(['github', 'gitlab']),
          url: z.string().url('请输入有效的仓库 URL'),
          accessToken: z.string().min(1, '访问令牌不能为空'),
          defaultBranch: z.string().optional(),
        }),
        z.object({
          mode: z.literal('create'),
          provider: z.enum(['github', 'gitlab']),
          name: z.string().min(1, '仓库名称不能为空'),
          accessToken: z.string().min(1, '访问令牌不能为空'),
          visibility: z.enum(['public', 'private']),
          defaultBranch: z.string().optional(),
          includeAppCode: z.boolean().optional(),
        }),
      ])
      .nullable()
      .optional(),
  }),
)

// 使用 vee-validate 的字段级别 API
const { defineField, handleSubmit, errors, values: formData, setFieldValue } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: '',
    slug: '',
    description: '',
    visibility: 'private' as const,
    templateId: null,
    templateConfig: {},
    repository: null,
  },
})

// 定义字段 - 自动处理 touched 状态
const [name, nameAttrs] = defineField('name', { validateOnBlur: true, validateOnModelUpdate: false })
const [slug, slugAttrs] = defineField('slug', { validateOnBlur: true, validateOnModelUpdate: false })
const [description, descriptionAttrs] = defineField('description', { validateOnBlur: true, validateOnModelUpdate: false })
const [visibility, visibilityAttrs] = defineField('visibility')

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
      return !!(name.value && slug.value && !errors.value.name && !errors.value.slug)
    case 1:
      return true // 模板是可选的
    case 2:
      return repositoryCanProceed.value && !!formData.repository // 仓库是必选的
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
  return labels[visibility.value || 'private']
})

// 自动生成 slug（只在 slug 为空或未被用户手动修改时生成）
const slugManuallyEdited = ref(false)

function generateSlug() {
  // 如果用户手动编辑过 slug，就不再自动生成
  if (slugManuallyEdited.value) return
  
  const generatedSlug = (name.value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  
  slug.value = generatedSlug
}

// 验证并格式化 slug
function validateSlug() {
  slugManuallyEdited.value = true
  const formattedSlug = (slug.value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  
  slug.value = formattedSlug
}

// 处理模板选择
function handleTemplateSelected(template: any) {
  selectedTemplate.value = template
}

// 导航
async function handleNext() {
  if (canProceed.value) {
    currentStep.value++
  } else if (currentStep.value === 0) {
    // 第一步验证失败时提示
    toast.error('请填写必填字段并确保格式正确')
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
  log.info('点击创建项目按钮')
  log.info('当前表单数据:', formData)
  log.info('name:', name.value)
  log.info('slug:', slug.value)
  log.info('visibility:', visibility.value)
  log.info('repository:', formData.repository)
  log.info('errors:', errors.value)
  
  // 直接调用，不通过 handleSubmit
  if (!name.value || !slug.value) {
    toast.error('请填写必填字段')
    return
  }
  
  loading.value = true
  try {
    const projectData: any = {
      organizationId: appStore.currentOrganizationId!,
      name: name.value,
      slug: slug.value,
      description: description.value || undefined,
      visibility: visibility.value,
      templateId: formData.templateId || undefined,
      templateConfig: formData.templateConfig || undefined,
      repository: formData.repository || undefined,
    }

    log.info('创建项目，数据:', projectData)
    const project = await createProject(projectData)
    log.info('项目创建成功，返回数据:', project)
    createdProjectId.value = project.id

    // toast 已经在 useProjectCRUD 中显示，不需要重复
    
    // 先跳转到项目详情页，再关闭弹窗
    log.info('准备跳转到项目详情页:', `/projects/${project.id}`)
    await router.push(`/projects/${project.id}`)
    log.info('跳转完成，准备关闭弹窗')
    emit('close')
  } catch (error: any) {
    log.error('Project creation failed:', error)
    // 错误已经在 useProjectCRUD 中通过 toast 显示
  } finally {
    loading.value = false
  }
}
</script>
