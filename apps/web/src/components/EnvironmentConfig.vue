<template>
  <div class="space-y-6">
    <div class="text-center space-y-2">
      <h3 class="text-lg font-semibold">配置部署环境</h3>
      <p class="text-muted-foreground">
        根据模板的默认配置自定义各环境的资源和变量
      </p>
    </div>

    <!-- 环境列表 -->
    <div class="space-y-4">
      <div
        v-for="(env, index) in environments"
        :key="env.type"
        class="border rounded-lg"
      >
        <div
          class="flex items-center justify-between p-4 cursor-pointer"
          @click="toggleEnvironment(index)"
        >
          <div class="flex items-center space-x-3">
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                getEnvironmentColor(env.type)
              ]"
            >
              <component :is="getEnvironmentIcon(env.type)" class="h-5 w-5" />
            </div>
            <div>
              <div class="font-semibold">{{ env.name }}</div>
              <div class="text-sm text-muted-foreground">
                {{ env.type }} 环境
              </div>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <Badge>{{ env.replicas }} 副本</Badge>
            <ChevronDown
              :class="[
                'h-5 w-5 transition-transform',
                expandedEnvs.includes(index) && 'rotate-180'
              ]"
            />
          </div>
        </div>

        <!-- 环境详细配置 -->
        <div
          v-if="expandedEnvs.includes(index)"
          class="p-4 pt-0 space-y-4 border-t"
        >
          <!-- 基本配置 -->
          <div class="grid md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label :for="`env-${index}-name`">环境名称</Label>
              <Input
                :id="`env-${index}-name`"
                v-model="env.name"
                placeholder="开发环境"
              />
            </div>

            <div class="space-y-2">
              <Label :for="`env-${index}-replicas`">副本数</Label>
              <Input
                :id="`env-${index}-replicas`"
                v-model.number="env.replicas"
                type="number"
                min="1"
                max="10"
              />
            </div>
          </div>

          <!-- 资源限制 -->
          <div>
            <Label class="mb-2 block">资源配置</Label>
            <div class="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm">请求资源 (Requests)</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                  <div class="space-y-2">
                    <Label :for="`env-${index}-cpu-request`" class="text-xs">CPU</Label>
                    <Input
                      :id="`env-${index}-cpu-request`"
                      v-model="env.resources.requests.cpu"
                      placeholder="100m"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label :for="`env-${index}-memory-request`" class="text-xs">内存</Label>
                    <Input
                      :id="`env-${index}-memory-request`"
                      v-model="env.resources.requests.memory"
                      placeholder="128Mi"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm">限制资源 (Limits)</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                  <div class="space-y-2">
                    <Label :for="`env-${index}-cpu-limit`" class="text-xs">CPU</Label>
                    <Input
                      :id="`env-${index}-cpu-limit`"
                      v-model="env.resources.limits.cpu"
                      placeholder="200m"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label :for="`env-${index}-memory-limit`" class="text-xs">内存</Label>
                    <Input
                      :id="`env-${index}-memory-limit`"
                      v-model="env.resources.limits.memory"
                      placeholder="256Mi"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <!-- 环境变量 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <Label>环境变量</Label>
              <Button
                variant="outline"
                size="sm"
                @click="addEnvVar(index)"
              >
                <Plus class="mr-2 h-4 w-4" />
                添加变量
              </Button>
            </div>
            <div class="space-y-2">
              <div
                v-for="(envVar, varIndex) in env.envVars"
                :key="varIndex"
                class="flex items-center space-x-2"
              >
                <Input
                  v-model="envVar.key"
                  placeholder="变量名"
                  class="flex-1"
                />
                <Input
                  v-model="envVar.value"
                  placeholder="变量值"
                  class="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  @click="removeEnvVar(index, varIndex)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>
              <p v-if="env.envVars.length === 0" class="text-sm text-muted-foreground text-center py-2">
                暂无环境变量
              </p>
            </div>
          </div>

          <!-- GitOps 配置 -->
          <div>
            <Label class="mb-2 block">GitOps 配置</Label>
            <div class="space-y-3">
              <div class="flex items-center space-x-2">
                <Checkbox
                  :id="`env-${index}-gitops-enabled`"
                  v-model:checked="env.gitops.enabled"
                />
                <Label
                  :for="`env-${index}-gitops-enabled`"
                  class="text-sm font-normal cursor-pointer"
                >
                  启用 GitOps 自动同步
                </Label>
              </div>

              <div v-if="env.gitops.enabled" class="grid md:grid-cols-2 gap-4 pl-6">
                <div class="space-y-2">
                  <Label :for="`env-${index}-git-branch`" class="text-xs">Git 分支</Label>
                  <Input
                    :id="`env-${index}-git-branch`"
                    v-model="env.gitops.gitBranch"
                    placeholder="main"
                  />
                </div>
                <div class="space-y-2">
                  <Label :for="`env-${index}-git-path`" class="text-xs">配置路径</Label>
                  <Input
                    :id="`env-${index}-git-path`"
                    v-model="env.gitops.gitPath"
                    placeholder="k8s/overlays/production"
                  />
                </div>
                <div class="space-y-2">
                  <Label :for="`env-${index}-sync-interval`" class="text-xs">同步间隔</Label>
                  <Select v-model="env.gitops.syncInterval">
                    <SelectTrigger :id="`env-${index}-sync-interval`">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">1 分钟</SelectItem>
                      <SelectItem value="5m">5 分钟</SelectItem>
                      <SelectItem value="10m">10 分钟</SelectItem>
                      <SelectItem value="30m">30 分钟</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex items-center space-x-2">
                  <Checkbox
                    :id="`env-${index}-auto-sync`"
                    v-model:checked="env.gitops.autoSync"
                  />
                  <Label
                    :for="`env-${index}-auto-sync`"
                    class="text-xs font-normal cursor-pointer"
                  >
                    自动同步变更
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <!-- 重置按钮 -->
          <div class="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              @click="resetEnvironment(index)"
            >
              <RotateCcw class="mr-2 h-4 w-4" />
              重置为默认配置
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <Alert>
      <Info class="h-4 w-4" />
      <AlertDescription>
        这些配置将用于生成 Kubernetes 部署文件。您可以在项目创建后继续调整。
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Button,
  Badge,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
} from '@juanie/ui'
import {
  ChevronDown,
  Plus,
  X,
  Info,
  RotateCcw,
  Laptop,
  TestTube,
  Rocket,
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: any[]
  template?: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any[]]
}>()

// 状态
const environments = ref<any[]>([])
const expandedEnvs = ref<number[]>([0]) // 默认展开第一个环境

// 默认环境配置
const defaultEnvironments = [
  {
    name: '开发环境',
    type: 'development',
    replicas: 1,
    resources: {
      requests: { cpu: '100m', memory: '128Mi' },
      limits: { cpu: '200m', memory: '256Mi' },
    },
    envVars: [],
    gitops: {
      enabled: true,
      autoSync: true,
      gitBranch: 'develop',
      gitPath: 'k8s/overlays/development',
      syncInterval: '1m',
    },
  },
  {
    name: '测试环境',
    type: 'staging',
    replicas: 2,
    resources: {
      requests: { cpu: '200m', memory: '256Mi' },
      limits: { cpu: '500m', memory: '512Mi' },
    },
    envVars: [],
    gitops: {
      enabled: true,
      autoSync: true,
      gitBranch: 'staging',
      gitPath: 'k8s/overlays/staging',
      syncInterval: '5m',
    },
  },
  {
    name: '生产环境',
    type: 'production',
    replicas: 3,
    resources: {
      requests: { cpu: '500m', memory: '512Mi' },
      limits: { cpu: '1000m', memory: '1Gi' },
    },
    envVars: [],
    gitops: {
      enabled: true,
      autoSync: false,
      gitBranch: 'main',
      gitPath: 'k8s/overlays/production',
      syncInterval: '10m',
    },
  },
]

// 获取环境图标
function getEnvironmentIcon(type: string) {
  const icons: Record<string, any> = {
    development: Laptop,
    staging: TestTube,
    production: Rocket,
  }
  return icons[type] || Laptop
}

// 获取环境颜色
function getEnvironmentColor(type: string): string {
  const colors: Record<string, string> = {
    development: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
    staging: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
    production: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
  }
  return colors[type] || 'bg-gray-100 text-gray-600'
}

// 切换环境展开状态
function toggleEnvironment(index: number) {
  const idx = expandedEnvs.value.indexOf(index)
  if (idx > -1) {
    expandedEnvs.value.splice(idx, 1)
  } else {
    expandedEnvs.value.push(index)
  }
}

// 添加环境变量
function addEnvVar(envIndex: number) {
  if (!environments.value[envIndex].envVars) {
    environments.value[envIndex].envVars = []
  }
  environments.value[envIndex].envVars.push({ key: '', value: '' })
}

// 删除环境变量
function removeEnvVar(envIndex: number, varIndex: number) {
  environments.value[envIndex].envVars.splice(varIndex, 1)
}

// 重置环境配置
function resetEnvironment(index: number) {
  const defaultEnv = defaultEnvironments[index]
  if (defaultEnv) {
    environments.value[index] = JSON.parse(JSON.stringify(defaultEnv))
  }
}

// 初始化环境配置
function initializeEnvironments() {
  // 如果模板有默认环境配置，使用模板配置
  if (props.template?.defaultConfig?.environments) {
    environments.value = JSON.parse(
      JSON.stringify(props.template.defaultConfig.environments)
    ).map((env: any) => ({
      ...env,
      envVars: env.envVars ? Object.entries(env.envVars).map(([key, value]) => ({ key, value })) : [],
    }))
  } else {
    // 否则使用默认配置
    environments.value = JSON.parse(JSON.stringify(defaultEnvironments))
  }

  // 发送初始值
  emit('update:modelValue', environments.value)
}

// 监听变化并更新父组件
watch(
  environments,
  (newEnvs) => {
    // 转换环境变量格式
    const formattedEnvs = newEnvs.map(env => ({
      ...env,
      envVars: env.envVars.reduce((acc: any, item: any) => {
        if (item.key) {
          acc[item.key] = item.value
        }
        return acc
      }, {}),
    }))
    emit('update:modelValue', formattedEnvs)
  },
  { deep: true }
)

// 监听模板变化
watch(
  () => props.template,
  () => {
    if (props.template) {
      initializeEnvironments()
    }
  }
)

onMounted(() => {
  initializeEnvironments()
})
</script>
