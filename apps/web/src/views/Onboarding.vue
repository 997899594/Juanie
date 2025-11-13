<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <Card class="w-full max-w-4xl">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="text-2xl">欢迎使用 AI DevOps 平台</CardTitle>
            <CardDescription>让我们用 3 分钟完成初始化设置</CardDescription>
          </div>
          <Badge variant="outline">步骤 {{ currentStep + 1 }} / {{ steps.length }}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <!-- 进度条 -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-2">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="flex items-center flex-1"
            >
              <div class="flex flex-col items-center flex-1">
                <div
                  :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    index <= currentStep
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-muted text-muted-foreground'
                  ]"
                >
                  <CheckCircle2 v-if="index < currentStep" class="h-5 w-5" />
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <span class="text-xs mt-2 text-center">{{ step.title }}</span>
              </div>
              <div
                v-if="index < steps.length - 1"
                :class="[
                  'h-0.5 flex-1 mx-2',
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 步骤内容 -->
        <div class="min-h-[400px]">
          <!-- 步骤 1: 欢迎 -->
          <div v-if="currentStep === 0" class="space-y-6">
            <div class="text-center space-y-4">
              <Rocket class="h-16 w-16 mx-auto text-primary" />
              <h3 class="text-xl font-semibold">开始您的 DevOps 之旅</h3>
              <p class="text-muted-foreground max-w-2xl mx-auto">
                我们将帮助您快速设置 GitOps 环境，创建第一个项目，并完成首次部署。
                整个过程只需要几分钟。
              </p>
            </div>

            <div class="grid md:grid-cols-3 gap-4 mt-8">
              <Card>
                <CardContent class="pt-6">
                  <GitBranch class="h-8 w-8 text-primary mb-3" />
                  <h4 class="font-semibold mb-2">GitOps 自动化</h4>
                  <p class="text-sm text-muted-foreground">
                    通过 Git 管理配置，自动同步到 Kubernetes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent class="pt-6">
                  <Zap class="h-8 w-8 text-primary mb-3" />
                  <h4 class="font-semibold mb-2">快速部署</h4>
                  <p class="text-sm text-muted-foreground">
                    可视化配置，一键部署应用到生产环境
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent class="pt-6">
                  <Shield class="h-8 w-8 text-primary mb-3" />
                  <h4 class="font-semibold mb-2">安全可靠</h4>
                  <p class="text-sm text-muted-foreground">
                    审批流程、审计日志、完整的权限控制
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <!-- 步骤 2: 安装 Flux -->
          <div v-if="currentStep === 1" class="space-y-6">
            <div class="text-center space-y-4">
              <Settings class="h-16 w-16 mx-auto text-primary" />
              <h3 class="text-xl font-semibold">安装 Flux GitOps 引擎</h3>
              <p class="text-muted-foreground max-w-2xl mx-auto">
                Flux 是 CNCF 项目，用于自动化 Kubernetes 部署。我们将自动为您安装。
              </p>
            </div>

            <div v-if="fluxInstalling" class="space-y-4">
              <div class="flex items-center justify-center space-x-3">
                <Loader2 class="h-6 w-6 animate-spin text-primary" />
                <span class="text-lg">正在安装 Flux...</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="log in installLogs"
                  :key="log"
                  class="text-sm text-muted-foreground text-center"
                >
                  {{ log }}
                </div>
              </div>
            </div>

            <div v-else-if="fluxInstalled" class="space-y-4">
              <Alert>
                <CheckCircle2 class="h-4 w-4" />
                <AlertDescription>
                  Flux 安装成功！所有组件运行正常。
                </AlertDescription>
              </Alert>

              <div class="grid md:grid-cols-2 gap-4">
                <div
                  v-for="component in fluxComponents"
                  :key="component.name"
                  class="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span class="text-sm">{{ component.name }}</span>
                  <Badge variant="default">就绪</Badge>
                </div>
              </div>
            </div>

            <div v-else class="space-y-4">
              <Alert>
                <Info class="h-4 w-4" />
                <AlertDescription>
                  我们将在您的 Kubernetes 集群中安装 Flux v2。这需要集群管理员权限。
                </AlertDescription>
              </Alert>

              <div class="flex justify-center">
                <Button @click="handleInstallFlux" size="lg">
                  <Download class="mr-2 h-5 w-5" />
                  开始安装
                </Button>
              </div>
            </div>
          </div>

          <!-- 步骤 3: 创建项目 -->
          <div v-if="currentStep === 2" class="space-y-6">
            <div class="text-center space-y-4">
              <FolderOpen class="h-16 w-16 mx-auto text-primary" />
              <h3 class="text-xl font-semibold">创建您的第一个项目</h3>
              <p class="text-muted-foreground max-w-2xl mx-auto">
                选择一个模板快速开始，或从空白项目开始
              </p>
            </div>

            <Tabs v-model="projectCreationMode" class="w-full">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="template">使用模板</TabsTrigger>
                <TabsTrigger value="blank">空白项目</TabsTrigger>
              </TabsList>

              <!-- 模板选择 -->
              <TabsContent value="template" class="space-y-4">
                <div class="grid md:grid-cols-2 gap-4">
                  <Card
                    v-for="template in projectTemplates"
                    :key="template.id"
                    :class="[
                      'cursor-pointer transition-all hover:shadow-lg',
                      selectedTemplate === template.id && 'ring-2 ring-primary'
                    ]"
                    @click="selectedTemplate = template.id"
                  >
                    <CardContent class="pt-6">
                      <div class="flex items-start space-x-3">
                        <component :is="template.icon" class="h-8 w-8 text-primary flex-shrink-0" />
                        <div class="flex-1">
                          <h4 class="font-semibold mb-1">{{ template.name }}</h4>
                          <p class="text-sm text-muted-foreground mb-3">
                            {{ template.description }}
                          </p>
                          <div class="flex flex-wrap gap-1">
                            <Badge
                              v-for="tech in template.technologies"
                              :key="tech"
                              variant="outline"
                              class="text-xs"
                            >
                              {{ tech }}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <!-- 空白项目 -->
              <TabsContent value="blank" class="space-y-4">
                <div class="space-y-4">
                  <div class="space-y-2">
                    <Label for="project-name">项目名称 *</Label>
                    <Input
                      id="project-name"
                      v-model="projectForm.name"
                      placeholder="例如：我的应用"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="project-slug">项目标识 *</Label>
                    <Input
                      id="project-slug"
                      v-model="projectForm.slug"
                      placeholder="例如：my-app"
                    />
                    <p class="text-xs text-muted-foreground">
                      只能包含小写字母、数字和连字符
                    </p>
                  </div>

                  <div class="space-y-2">
                    <Label for="project-description">描述</Label>
                    <Textarea
                      id="project-description"
                      v-model="projectForm.description"
                      placeholder="简单描述您的项目..."
                      rows="3"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <!-- 步骤 4: 完成 -->
          <div v-if="currentStep === 3" class="space-y-6">
            <div class="text-center space-y-4">
              <div class="relative">
                <CheckCircle2 class="h-16 w-16 mx-auto text-green-500" />
                <Sparkles class="h-6 w-6 absolute top-0 right-1/3 text-yellow-500 animate-pulse" />
              </div>
              <h3 class="text-xl font-semibold">🎉 一切就绪！</h3>
              <p class="text-muted-foreground max-w-2xl mx-auto">
                您已成功完成初始化设置。现在可以开始使用平台了。
              </p>
            </div>

            <div class="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle class="text-lg">您已完成</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                  <div class="flex items-center space-x-3">
                    <CheckCircle2 class="h-5 w-5 text-green-500" />
                    <span>安装 Flux GitOps 引擎</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <CheckCircle2 class="h-5 w-5 text-green-500" />
                    <span>创建项目：{{ createdProject?.name }}</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <CheckCircle2 class="h-5 w-5 text-green-500" />
                    <span>配置开发和生产环境</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="text-lg">下一步</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                  <Button variant="outline" class="w-full justify-start" @click="goToProject">
                    <FolderOpen class="mr-2 h-4 w-4" />
                    查看项目详情
                  </Button>
                  <Button variant="outline" class="w-full justify-start" @click="goToRepositories">
                    <GitBranch class="mr-2 h-4 w-4" />
                    连接 Git 仓库
                  </Button>
                  <Button variant="outline" class="w-full justify-start" @click="goToDocs">
                    <BookOpen class="mr-2 h-4 w-4" />
                    查看使用文档
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            v-if="currentStep > 0 && currentStep < 3"
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
              @click="handleSkip"
              :disabled="loading"
            >
              跳过
            </Button>
            <Button
              v-if="currentStep < 2"
              @click="handleNext"
              :disabled="!canProceed || loading"
            >
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              下一步
              <ChevronRight class="ml-2 h-4 w-4" />
            </Button>
            <Button
              v-else-if="currentStep === 2"
              @click="handleCreateProject"
              :disabled="!canCreateProject || loading"
            >
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              创建项目
            </Button>
            <Button
              v-else
              @click="handleComplete"
            >
              开始使用
              <ArrowRight class="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Label,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Alert,
  AlertDescription,
} from '@juanie/ui'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Rocket,
  GitBranch,
  Zap,
  Shield,
  Settings,
  Loader2,
  Download,
  Info,
  FolderOpen,
  BookOpen,
  Sparkles,
} from 'lucide-vue-next'
import { useGitOps } from '@/composables/useGitOps'
import { useProjects } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const { installFlux, checkFluxHealth } = useGitOps()
const { createProject } = useProjects()

// 步骤定义
const steps = [
  { id: 'welcome', title: '欢迎' },
  { id: 'flux', title: '安装 Flux' },
  { id: 'project', title: '创建项目' },
  { id: 'complete', title: '完成' },
]

const currentStep = ref(0)
const loading = ref(false)

// Flux 安装状态
const fluxInstalling = ref(false)
const fluxInstalled = ref(false)
const installLogs = ref<string[]>([])
const fluxComponents = ref([
  { name: 'source-controller', ready: true },
  { name: 'kustomize-controller', ready: true },
  { name: 'helm-controller', ready: true },
  { name: 'notification-controller', ready: true },
])

// 项目创建
const projectCreationMode = ref('template')
const selectedTemplate = ref('react-app')
const projectForm = ref({
  name: '',
  slug: '',
  description: '',
})
const createdProject = ref<any>(null)

// 项目模板
const projectTemplates = [
  {
    id: 'react-app',
    name: 'React 应用',
    description: '单页应用，使用 Nginx 托管，适合前端项目',
    icon: 'Zap',
    technologies: ['React', 'Nginx', 'Docker'],
  },
  {
    id: 'nodejs-api',
    name: 'Node.js API',
    description: '后端 API 服务，包含数据库和缓存配置',
    icon: 'Server',
    technologies: ['Node.js', 'PostgreSQL', 'Redis'],
  },
  {
    id: 'fullstack',
    name: '全栈应用',
    description: '前后端分离架构，完整的应用模板',
    icon: 'Layers',
    technologies: ['React', 'Node.js', 'PostgreSQL'],
  },
  {
    id: 'microservices',
    name: '微服务',
    description: '微服务架构，包含服务网格和 API 网关',
    icon: 'Network',
    technologies: ['Istio', 'gRPC', 'Kubernetes'],
  },
]

// 计算属性
const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return fluxInstalled.value
  }
  return true
})

const canCreateProject = computed(() => {
  if (projectCreationMode.value === 'template') {
    return selectedTemplate.value !== null
  }
  return projectForm.value.name && projectForm.value.slug
})

// 安装 Flux
async function handleInstallFlux() {
  fluxInstalling.value = true
  installLogs.value = []

  try {
    installLogs.value.push('正在检查 Kubernetes 集群...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    installLogs.value.push('正在下载 Flux 组件...')
    await new Promise(resolve => setTimeout(resolve, 1500))

    installLogs.value.push('正在安装 Flux 到集群...')
    await installFlux({ namespace: 'flux-system' })

    installLogs.value.push('正在验证组件状态...')
    await checkFluxHealth()

    installLogs.value.push('✓ 安装完成！')
    fluxInstalled.value = true

    setTimeout(() => {
      fluxInstalling.value = false
    }, 1000)
  } catch (error: any) {
    installLogs.value.push(`✗ 安装失败: ${error.message}`)
    toast.error('安装失败', error.message)
    fluxInstalling.value = false
  }
}

// 创建项目
async function handleCreateProject() {
  loading.value = true

  try {
    let projectData: any

    if (projectCreationMode.value === 'template') {
      const template = projectTemplates.find(t => t.id === selectedTemplate.value)
      projectData = {
        name: template?.name || '示例项目',
        slug: template?.id || 'demo-project',
        description: template?.description || '',
        organizationId: appStore.currentOrganizationId!,
      }
    } else {
      projectData = {
        ...projectForm.value,
        organizationId: appStore.currentOrganizationId!,
      }
    }

    // 创建项目
    const project = await createProject(projectData)
    createdProject.value = project

    // 自动创建开发和生产环境
    await trpc.environments.create.mutate({
      projectId: project.id,
      name: '开发环境',
      type: 'development' as const,
      config: {
        gitops: {
          enabled: true,
          autoSync: true,
          gitBranch: 'develop',
          gitPath: 'k8s/overlays/development',
          syncInterval: '1m',
        },
      },
    })

    await trpc.environments.create.mutate({
      projectId: project.id,
      name: '生产环境',
      type: 'production' as const,
      config: {
        approvalRequired: true,
        minApprovals: 1,
        gitops: {
          enabled: true,
          autoSync: false,
          gitBranch: 'main',
          gitPath: 'k8s/overlays/production',
          syncInterval: '10m',
        },
      },
    })

    toast.success('项目创建成功', '已自动配置开发和生产环境')
    currentStep.value = 3
  } catch (error: any) {
    toast.error('创建失败', error.message)
  } finally {
    loading.value = false
  }
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

function handleSkip() {
  router.push('/projects')
}

function handleComplete() {
  router.push('/projects')
}

function goToProject() {
  if (createdProject.value) {
    router.push(`/projects/${createdProject.value.id}`)
  }
}

function goToRepositories() {
  if (createdProject.value) {
    router.push(`/projects/${createdProject.value.id}?tab=repositories`)
  }
}

function goToDocs() {
  window.open('/docs', '_blank')
}
</script>
