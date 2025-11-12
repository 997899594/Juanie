<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>GitOps 部署</DialogTitle>
        <DialogDescription>
          通过可视化表单配置部署参数，系统将自动生成 Git commit 并触发 Flux 同步
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="flex-1 overflow-hidden flex flex-col">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="form">可视化配置</TabsTrigger>
          <TabsTrigger value="yaml">YAML 预览</TabsTrigger>
          <TabsTrigger value="diff">变更对比</TabsTrigger>
        </TabsList>

        <!-- 可视化表单 -->
        <TabsContent value="form" class="flex-1 overflow-y-auto space-y-6 mt-4">
          <div class="space-y-4">
            <!-- 镜像配置 -->
            <div class="space-y-2">
              <Label for="image">容器镜像 *</Label>
              <Input
                id="image"
                v-model="form.image"
                placeholder="例如：nginx:1.21.0"
                :class="{ 'border-destructive': errors.image }"
              />
              <p v-if="errors.image" class="text-sm text-destructive">{{ errors.image }}</p>
              <p class="text-xs text-muted-foreground">
                完整的镜像地址，包含仓库、名称和标签
              </p>
            </div>

            <!-- 副本数 -->
            <div class="space-y-2">
              <Label for="replicas">副本数</Label>
              <Input
                id="replicas"
                v-model.number="form.replicas"
                type="number"
                min="1"
                placeholder="例如：3"
              />
              <p class="text-xs text-muted-foreground">
                Pod 副本数量，建议生产环境至少 2 个
              </p>
            </div>

            <!-- 环境变量 -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>环境变量</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="addEnvVar"
                >
                  <Plus class="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
              <div v-if="envVars.length === 0" class="text-sm text-muted-foreground">
                暂无环境变量
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(env, index) in envVars"
                  :key="index"
                  class="flex gap-2 items-start"
                >
                  <Input
                    v-model="env.key"
                    placeholder="KEY"
                    class="flex-1"
                  />
                  <Input
                    v-model="env.value"
                    placeholder="value"
                    class="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    @click="removeEnvVar(index)"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <!-- 资源限制 -->
            <div class="space-y-4">
              <Label>资源配置</Label>
              
              <!-- CPU 请求 -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="cpu-request" class="text-sm">CPU 请求</Label>
                  <Input
                    id="cpu-request"
                    v-model="form.resources.requests.cpu"
                    placeholder="例如：100m"
                  />
                  <p class="text-xs text-muted-foreground">
                    最小 CPU 保证（如 100m, 0.5, 1）
                  </p>
                </div>
                <div class="space-y-2">
                  <Label for="cpu-limit" class="text-sm">CPU 限制</Label>
                  <Input
                    id="cpu-limit"
                    v-model="form.resources.limits.cpu"
                    placeholder="例如：500m"
                  />
                  <p class="text-xs text-muted-foreground">
                    最大 CPU 使用（如 500m, 1, 2）
                  </p>
                </div>
              </div>

              <!-- 内存请求 -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="memory-request" class="text-sm">内存请求</Label>
                  <Input
                    id="memory-request"
                    v-model="form.resources.requests.memory"
                    placeholder="例如：128Mi"
                  />
                  <p class="text-xs text-muted-foreground">
                    最小内存保证（如 128Mi, 1Gi）
                  </p>
                </div>
                <div class="space-y-2">
                  <Label for="memory-limit" class="text-sm">内存限制</Label>
                  <Input
                    id="memory-limit"
                    v-model="form.resources.limits.memory"
                    placeholder="例如：512Mi"
                  />
                  <p class="text-xs text-muted-foreground">
                    最大内存使用（如 512Mi, 2Gi）
                  </p>
                </div>
              </div>
            </div>

            <!-- Commit 消息 -->
            <div class="space-y-2">
              <Label for="commitMessage">Commit 消息</Label>
              <Textarea
                id="commitMessage"
                v-model="form.commitMessage"
                placeholder="描述本次部署的变更内容..."
                rows="3"
              />
              <p class="text-xs text-muted-foreground">
                将记录在 Git 历史中，建议描述清楚变更内容
              </p>
            </div>

            <!-- GitOps 模式提示 -->
            <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div class="flex gap-3">
                <Info class="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div class="space-y-1">
                  <p class="text-sm font-medium text-blue-900">GitOps 部署模式</p>
                  <p class="text-sm text-blue-700">
                    您的配置将自动转换为 Kubernetes YAML 并提交到 Git 仓库。
                    Flux 会检测到变更并自动应用到集群中。整个过程可追溯、可审计。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- YAML 预览 -->
        <TabsContent value="yaml" class="flex-1 overflow-hidden mt-4">
          <div class="h-full border rounded-lg overflow-hidden">
            <div class="bg-muted px-4 py-2 border-b flex items-center justify-between">
              <span class="text-sm font-medium">生成的 YAML 配置</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                @click="copyYAML"
                :disabled="!yamlPreview"
              >
                <Copy class="h-4 w-4 mr-1" />
                复制
              </Button>
            </div>
            <ScrollArea class="h-[400px]">
              <pre class="p-4 text-sm"><code>{{ yamlPreview || '请先填写配置信息' }}</code></pre>
            </ScrollArea>
          </div>
        </TabsContent>

        <!-- 变更对比 -->
        <TabsContent value="diff" class="flex-1 overflow-hidden mt-4">
          <div class="h-full border rounded-lg overflow-hidden">
            <div class="bg-muted px-4 py-2 border-b">
              <span class="text-sm font-medium">配置变更对比</span>
            </div>
            <ScrollArea class="h-[400px]">
              <div v-if="diffPreview" class="p-4">
                <pre class="text-sm whitespace-pre-wrap"><code v-html="diffPreview"></code></pre>
              </div>
              <div v-else class="p-4 text-sm text-muted-foreground">
                暂无变更对比数据
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter class="mt-4">
        <Button
          type="button"
          variant="outline"
          @click="handleCancel"
          :disabled="loading"
        >
          取消
        </Button>
        <Button
          type="button"
          @click="handleDeploy"
          :disabled="loading || !isFormValid"
        >
          <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
          <GitBranch v-else class="mr-2 h-4 w-4" />
          提交部署
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@juanie/ui'
import { Plus, X, Info, Copy, Loader2, GitBranch } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

interface Props {
  open: boolean
  projectId: string
  environmentId: string
  loading?: boolean
}

interface EnvVar {
  key: string
  value: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'deploy': [data: any]
}>()

const toast = useToast()
const activeTab = ref('form')
const loading = ref(false)
const errors = ref<Record<string, string>>({})

// 表单数据
const form = reactive({
  image: '',
  replicas: undefined as number | undefined,
  commitMessage: '',
  resources: {
    requests: {
      cpu: '',
      memory: '',
    },
    limits: {
      cpu: '',
      memory: '',
    },
  },
})

// 环境变量列表
const envVars = ref<EnvVar[]>([])

// YAML 预览
const yamlPreview = ref('')
const diffPreview = ref('')

// 表单验证
const isFormValid = computed(() => {
  return form.image.trim().length > 0
})

// 添加环境变量
const addEnvVar = () => {
  envVars.value.push({ key: '', value: '' })
}

// 删除环境变量
const removeEnvVar = (index: number) => {
  envVars.value.splice(index, 1)
}

// 复制 YAML
const copyYAML = async () => {
  if (!yamlPreview.value) return
  
  try {
    await navigator.clipboard.writeText(yamlPreview.value)
    toast.success('已复制到剪贴板')
  } catch (error) {
    toast.error('复制失败', '请手动复制')
  }
}

// 构建变更对象
const buildChanges = () => {
  const changes: any = {}
  
  if (form.image) {
    changes.image = form.image
  }
  
  if (form.replicas) {
    changes.replicas = form.replicas
  }
  
  // 环境变量
  if (envVars.value.length > 0) {
    changes.env = {}
    envVars.value.forEach(env => {
      if (env.key && env.value) {
        changes.env[env.key] = env.value
      }
    })
  }
  
  // 资源配置
  const hasResources = 
    form.resources.requests.cpu ||
    form.resources.requests.memory ||
    form.resources.limits.cpu ||
    form.resources.limits.memory
  
  if (hasResources) {
    changes.resources = {}
    
    if (form.resources.requests.cpu || form.resources.requests.memory) {
      changes.resources.requests = {}
      if (form.resources.requests.cpu) {
        changes.resources.requests.cpu = form.resources.requests.cpu
      }
      if (form.resources.requests.memory) {
        changes.resources.requests.memory = form.resources.requests.memory
      }
    }
    
    if (form.resources.limits.cpu || form.resources.limits.memory) {
      changes.resources.limits = {}
      if (form.resources.limits.cpu) {
        changes.resources.limits.cpu = form.resources.limits.cpu
      }
      if (form.resources.limits.memory) {
        changes.resources.limits.memory = form.resources.limits.memory
      }
    }
  }
  
  return changes
}

// 加载预览
const loadPreview = async () => {
  if (!isFormValid.value) {
    yamlPreview.value = ''
    diffPreview.value = ''
    return
  }
  
  try {
    const changes = buildChanges()
    
    const result = await trpc.gitops.previewChanges.query({
      projectId: props.projectId,
      environmentId: props.environmentId,
      changes,
    })
    
    yamlPreview.value = result.yaml || ''
    diffPreview.value = result.diff || ''
  } catch (error) {
    console.error('Failed to load preview:', error)
  }
}

// 监听表单变化，自动更新预览
watch(
  () => [form.image, form.replicas, form.resources, envVars.value],
  () => {
    if (activeTab.value === 'yaml' || activeTab.value === 'diff') {
      loadPreview()
    }
  },
  { deep: true }
)

// 切换标签页时加载预览
watch(activeTab, (newTab) => {
  if ((newTab === 'yaml' || newTab === 'diff') && isFormValid.value) {
    loadPreview()
  }
})

// 验证表单
const validateForm = () => {
  errors.value = {}
  
  if (!form.image.trim()) {
    errors.value.image = '请输入容器镜像'
    return false
  }
  
  // 验证镜像格式（简单验证）
  if (!form.image.includes(':')) {
    errors.value.image = '镜像格式不正确，应包含标签（如 nginx:1.21.0）'
    return false
  }
  
  return true
}

// 处理部署
const handleDeploy = async () => {
  if (!validateForm()) {
    activeTab.value = 'form'
    return
  }
  
  loading.value = true
  
  try {
    const changes = buildChanges()
    
    const result = await trpc.gitops.deployWithGitOps.mutate({
      projectId: props.projectId,
      environmentId: props.environmentId,
      changes,
      commitMessage: form.commitMessage || `部署 ${form.image}`,
    })
    
    toast.success('部署已提交', result.message)
    emit('deploy', result)
    handleCancel()
  } catch (error: any) {
    console.error('Deploy failed:', error)
    toast.error('部署失败', error.message || '请稍后重试')
  } finally {
    loading.value = false
  }
}

// 处理取消
const handleCancel = () => {
  emit('update:open', false)
}

// 处理对话框关闭
const handleOpenChange = (value: boolean) => {
  emit('update:open', value)
}

// 重置表单
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    // 重置表单
    form.image = ''
    form.replicas = undefined
    form.commitMessage = ''
    form.resources.requests.cpu = ''
    form.resources.requests.memory = ''
    form.resources.limits.cpu = ''
    form.resources.limits.memory = ''
    envVars.value = []
    errors.value = {}
    activeTab.value = 'form'
    yamlPreview.value = ''
    diffPreview.value = ''
  }
})
</script>
