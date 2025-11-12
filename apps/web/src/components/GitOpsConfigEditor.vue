<template>
  <div class="h-full flex flex-col">
    <!-- 标签页导航 -->
    <Tabs v-model="activeTab" class="flex-1 flex flex-col">
      <TabsList class="grid w-full grid-cols-3">
        <TabsTrigger value="visual">
          <Sliders class="h-4 w-4 mr-2" />
          可视化
        </TabsTrigger>
        <TabsTrigger value="yaml">
          <FileCode class="h-4 w-4 mr-2" />
          YAML
        </TabsTrigger>
        <TabsTrigger value="diff">
          <GitCompare class="h-4 w-4 mr-2" />
          Diff
        </TabsTrigger>
      </TabsList>

      <!-- 可视化编辑器 -->
      <TabsContent value="visual" class="flex-1 overflow-y-auto mt-4">
        <div class="space-y-6">
          <!-- 基础配置 -->
          <Card>
            <CardHeader>
              <CardTitle>基础配置</CardTitle>
              <CardDescription>
                配置应用的基本部署参数
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="name">应用名称</Label>
                  <Input
                    id="name"
                    v-model="config.name"
                    placeholder="my-app"
                    @input="handleConfigChange"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="namespace">命名空间</Label>
                  <Input
                    id="namespace"
                    v-model="config.namespace"
                    placeholder="default"
                    @input="handleConfigChange"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <Label for="image">容器镜像</Label>
                <Input
                  id="image"
                  v-model="config.image"
                  placeholder="nginx:1.21.0"
                  @input="handleConfigChange"
                />
              </div>

              <div class="space-y-2">
                <Label for="replicas">副本数</Label>
                <Input
                  id="replicas"
                  v-model.number="config.replicas"
                  type="number"
                  min="1"
                  @input="handleConfigChange"
                />
              </div>
            </CardContent>
          </Card>

          <!-- 环境变量 -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>环境变量</CardTitle>
                  <CardDescription>
                    配置应用运行时的环境变量
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  @click="addEnvVar"
                >
                  <Plus class="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="envVars.length === 0" class="text-sm text-muted-foreground text-center py-4">
                暂无环境变量
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(env, index) in envVars"
                  :key="index"
                  class="flex gap-2 items-center"
                >
                  <Input
                    v-model="env.key"
                    placeholder="KEY"
                    class="flex-1"
                    @input="handleConfigChange"
                  />
                  <Input
                    v-model="env.value"
                    placeholder="value"
                    class="flex-1"
                    @input="handleConfigChange"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    @click="removeEnvVar(index)"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 资源配置 -->
          <Card>
            <CardHeader>
              <CardTitle>资源配置</CardTitle>
              <CardDescription>
                配置 CPU 和内存的请求与限制
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>CPU 请求</Label>
                  <Input
                    v-model="config.resources.requests.cpu"
                    placeholder="100m"
                    @input="handleConfigChange"
                  />
                  <p class="text-xs text-muted-foreground">
                    如：100m, 0.5, 1
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>CPU 限制</Label>
                  <Input
                    v-model="config.resources.limits.cpu"
                    placeholder="500m"
                    @input="handleConfigChange"
                  />
                  <p class="text-xs text-muted-foreground">
                    如：500m, 1, 2
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>内存请求</Label>
                  <Input
                    v-model="config.resources.requests.memory"
                    placeholder="128Mi"
                    @input="handleConfigChange"
                  />
                  <p class="text-xs text-muted-foreground">
                    如：128Mi, 1Gi
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>内存限制</Label>
                  <Input
                    v-model="config.resources.limits.memory"
                    placeholder="512Mi"
                    @input="handleConfigChange"
                  />
                  <p class="text-xs text-muted-foreground">
                    如：512Mi, 2Gi
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 端口配置 -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>端口配置</CardTitle>
                  <CardDescription>
                    配置容器暴露的端口
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  @click="addPort"
                >
                  <Plus class="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="ports.length === 0" class="text-sm text-muted-foreground text-center py-4">
                暂无端口配置
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(port, index) in ports"
                  :key="index"
                  class="flex gap-2 items-center"
                >
                  <Input
                    v-model="port.name"
                    placeholder="http"
                    class="flex-1"
                    @input="handleConfigChange"
                  />
                  <Input
                    v-model.number="port.port"
                    type="number"
                    placeholder="80"
                    class="flex-1"
                    @input="handleConfigChange"
                  />
                  <Select v-model="port.protocol" @update:model-value="handleConfigChange">
                    <SelectTrigger class="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TCP">TCP</SelectItem>
                      <SelectItem value="UDP">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    @click="removePort(index)"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- YAML 编辑器 -->
      <TabsContent value="yaml" class="flex-1 overflow-hidden mt-4">
        <div class="h-full border rounded-lg overflow-hidden flex flex-col">
          <div class="bg-muted px-4 py-2 border-b flex items-center justify-between">
            <span class="text-sm font-medium">YAML 配置</span>
            <div class="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                @click="formatYAML"
              >
                <Wand2 class="h-4 w-4 mr-1" />
                格式化
              </Button>
              <Button
                variant="ghost"
                size="sm"
                @click="validateYAML"
                :disabled="validating"
              >
                <Loader2 v-if="validating" class="h-4 w-4 mr-1 animate-spin" />
                <CheckCircle2 v-else class="h-4 w-4 mr-1" />
                验证
              </Button>
            </div>
          </div>
          
          <div class="flex-1 overflow-hidden">
            <Textarea
              v-model="yamlContent"
              class="h-full font-mono text-sm resize-none border-0 rounded-none"
              placeholder="在此编辑 YAML 配置..."
              @input="handleYAMLChange"
            />
          </div>

          <!-- 验证结果 -->
          <div v-if="validationResult" class="border-t p-4">
            <Alert :variant="validationResult.valid ? 'default' : 'destructive'">
              <CheckCircle2 v-if="validationResult.valid" class="h-4 w-4" />
              <AlertCircle v-else class="h-4 w-4" />
              <AlertDescription>
                {{ validationResult.message }}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </TabsContent>

      <!-- Diff 视图 -->
      <TabsContent value="diff" class="flex-1 overflow-hidden mt-4">
        <div class="h-full border rounded-lg overflow-hidden flex flex-col">
          <div class="bg-muted px-4 py-2 border-b">
            <span class="text-sm font-medium">配置变更对比</span>
          </div>
          
          <ScrollArea class="flex-1">
            <div v-if="diffContent" class="p-4">
              <pre class="text-sm font-mono whitespace-pre-wrap"><code v-html="diffContent"></code></pre>
            </div>
            <div v-else class="p-4 text-center text-sm text-muted-foreground">
              <GitCompare class="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无变更</p>
            </div>
          </ScrollArea>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Button,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Alert,
  AlertDescription,
} from '@juanie/ui'
import {
  Sliders,
  FileCode,
  GitCompare,
  Plus,
  X,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

interface Props {
  modelValue?: any
  originalConfig?: any
}

interface EnvVar {
  key: string
  value: string
}

interface Port {
  name: string
  port: number
  protocol: 'TCP' | 'UDP'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: any]
  'change': [value: any]
}>()

const toast = useToast()
const activeTab = ref('visual')
const validating = ref(false)
const validationResult = ref<{ valid: boolean; message: string } | null>(null)

// 配置数据
const config = reactive({
  name: '',
  namespace: 'default',
  image: '',
  replicas: 1,
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

const envVars = ref<EnvVar[]>([])
const ports = ref<Port[]>([])
const yamlContent = ref('')
const diffContent = ref('')

// 添加环境变量
const addEnvVar = () => {
  envVars.value.push({ key: '', value: '' })
}

// 删除环境变量
const removeEnvVar = (index: number) => {
  envVars.value.splice(index, 1)
  handleConfigChange()
}

// 添加端口
const addPort = () => {
  ports.value.push({ name: '', port: 80, protocol: 'TCP' })
}

// 删除端口
const removePort = (index: number) => {
  ports.value.splice(index, 1)
  handleConfigChange()
}

// 生成 YAML
const generateYAML = () => {
  const deployment: any = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: config.name || 'app',
      namespace: config.namespace || 'default',
    },
    spec: {
      replicas: config.replicas || 1,
      selector: {
        matchLabels: {
          app: config.name || 'app',
        },
      },
      template: {
        metadata: {
          labels: {
            app: config.name || 'app',
          },
        },
        spec: {
          containers: [
            {
              name: config.name || 'app',
              image: config.image || 'nginx:latest',
            },
          ],
        },
      },
    },
  }

  // 添加环境变量
  if (envVars.value.length > 0) {
    deployment.spec.template.spec.containers[0].env = envVars.value
      .filter(e => e.key && e.value)
      .map(e => ({ name: e.key, value: e.value }))
  }

  // 添加端口
  if (ports.value.length > 0) {
    deployment.spec.template.spec.containers[0].ports = ports.value
      .filter(p => p.port)
      .map(p => ({
        name: p.name || 'port',
        containerPort: p.port,
        protocol: p.protocol,
      }))
  }

  // 添加资源配置
  const hasResources =
    config.resources.requests.cpu ||
    config.resources.requests.memory ||
    config.resources.limits.cpu ||
    config.resources.limits.memory

  if (hasResources) {
    const resources: any = {}

    if (config.resources.requests.cpu || config.resources.requests.memory) {
      resources.requests = {}
      if (config.resources.requests.cpu) {
        resources.requests.cpu = config.resources.requests.cpu
      }
      if (config.resources.requests.memory) {
        resources.requests.memory = config.resources.requests.memory
      }
    }

    if (config.resources.limits.cpu || config.resources.limits.memory) {
      resources.limits = {}
      if (config.resources.limits.cpu) {
        resources.limits.cpu = config.resources.limits.cpu
      }
      if (config.resources.limits.memory) {
        resources.limits.memory = config.resources.limits.memory
      }
    }

    deployment.spec.template.spec.containers[0].resources = resources
  }

  // 转换为 YAML 字符串（简单实现）
  return JSON.stringify(deployment, null, 2)
}

// 处理配置变更
const handleConfigChange = () => {
  const fullConfig = {
    ...config,
    env: envVars.value.filter(e => e.key && e.value),
    ports: ports.value.filter(p => p.port),
  }

  emit('update:modelValue', fullConfig)
  emit('change', fullConfig)

  // 更新 YAML
  yamlContent.value = generateYAML()

  // 生成 diff
  generateDiff()
}

// 处理 YAML 变更
const handleYAMLChange = () => {
  // TODO: 解析 YAML 并更新可视化配置
  emit('change', { yaml: yamlContent.value })
}

// 格式化 YAML
const formatYAML = () => {
  try {
    // 简单的格式化（实际应使用 YAML 库）
    const parsed = JSON.parse(yamlContent.value)
    yamlContent.value = JSON.stringify(parsed, null, 2)
    toast.success('格式化成功')
  } catch (error) {
    toast.error('格式化失败', 'YAML 格式不正确')
  }
}

// 验证 YAML
const validateYAML = async () => {
  validating.value = true
  validationResult.value = null

  try {
    const result = await trpc.gitops.validateYAML.query({
      content: yamlContent.value,
    })

    validationResult.value = {
      valid: result.valid,
      message: result.valid ? 'YAML 格式正确' : result.error || 'YAML 格式错误',
    }

    if (result.valid) {
      toast.success('验证通过')
    } else {
      toast.error('验证失败', result.error)
    }
  } catch (error: any) {
    validationResult.value = {
      valid: false,
      message: error.message || '验证失败',
    }
    toast.error('验证失败', error.message)
  } finally {
    validating.value = false
  }
}

// 生成 diff
const generateDiff = () => {
  if (!props.originalConfig) {
    diffContent.value = ''
    return
  }

  // 简单的 diff 实现（实际应使用 diff 库）
  const original = JSON.stringify(props.originalConfig, null, 2)
  const current = generateYAML()

  if (original === current) {
    diffContent.value = ''
    return
  }

  // 生成简单的 diff 显示
  const originalLines = original.split('\n')
  const currentLines = current.split('\n')
  const maxLines = Math.max(originalLines.length, currentLines.length)

  let diff = ''
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || ''
    const currentLine = currentLines[i] || ''

    if (originalLine !== currentLine) {
      if (originalLine) {
        diff += `<span class="text-red-600">- ${originalLine}</span>\n`
      }
      if (currentLine) {
        diff += `<span class="text-green-600">+ ${currentLine}</span>\n`
      }
    } else {
      diff += `  ${originalLine}\n`
    }
  }

  diffContent.value = diff
}

// 初始化
watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      Object.assign(config, value)
      if (value.env) {
        envVars.value = value.env
      }
      if (value.ports) {
        ports.value = value.ports
      }
      yamlContent.value = generateYAML()
      generateDiff()
    }
  },
  { immediate: true, deep: true }
)
</script>
