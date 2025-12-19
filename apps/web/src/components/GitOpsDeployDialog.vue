<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>GitOps 部署</DialogTitle>
        <DialogDescription>
          通过 Git 提交配置变更，Flux 将自动同步到 Kubernetes
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="config">配置变更</TabsTrigger>
          <TabsTrigger value="preview">预览</TabsTrigger>
          <TabsTrigger value="yaml">YAML</TabsTrigger>
        </TabsList>

        <!-- 配置变更标签 -->
        <TabsContent value="config" class="space-y-4 mt-4">
          <div class="space-y-2">
            <Label for="image">镜像</Label>
            <Input
              id="image"
              v-model="formData.image"
              placeholder="registry.example.com/app:v1.0.0"
            />
          </div>

          <div class="space-y-2">
            <Label for="replicas">副本数</Label>
            <Input
              id="replicas"
              v-model.number="formData.replicas"
              type="number"
              min="1"
            />
          </div>

          <div class="space-y-2">
            <Label>环境变量</Label>
            <div class="space-y-2">
              <div
                v-for="(env, index) in formData.env"
                :key="index"
                class="flex gap-2"
              >
                <Input
                  v-model="env.name"
                  placeholder="KEY"
                  class="flex-1"
                />
                <Input
                  v-model="env.value"
                  placeholder="value"
                  class="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  @click="removeEnv(index)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                @click="addEnv"
              >
                <Plus class="h-4 w-4 mr-2" />
                添加环境变量
              </Button>
            </div>
          </div>

          <div class="space-y-2">
            <Label>资源限制</Label>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="cpuLimit" class="text-xs">CPU 限制</Label>
                <Input
                  id="cpuLimit"
                  v-model="formData.resources.limits.cpu"
                  placeholder="1000m"
                />
              </div>
              <div class="space-y-2">
                <Label for="memoryLimit" class="text-xs">内存限制</Label>
                <Input
                  id="memoryLimit"
                  v-model="formData.resources.limits.memory"
                  placeholder="512Mi"
                />
              </div>
              <div class="space-y-2">
                <Label for="cpuRequest" class="text-xs">CPU 请求</Label>
                <Input
                  id="cpuRequest"
                  v-model="formData.resources.requests.cpu"
                  placeholder="100m"
                />
              </div>
              <div class="space-y-2">
                <Label for="memoryRequest" class="text-xs">内存请求</Label>
                <Input
                  id="memoryRequest"
                  v-model="formData.resources.requests.memory"
                  placeholder="128Mi"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- 预览标签 -->
        <TabsContent value="preview" class="mt-4">
          <div v-if="previewLoading" class="flex items-center justify-center py-8">
            <Loader2 class="h-6 w-6 animate-spin" />
          </div>
          <div v-else-if="preview" class="space-y-4">
            <Alert>
              <AlertCircle class="h-4 w-4" />
              <AlertTitle>变更预览</AlertTitle>
              <AlertDescription>
                以下是将要提交到 Git 的配置变更
              </AlertDescription>
            </Alert>
            <pre class="p-4 bg-muted rounded-lg text-sm overflow-x-auto">{{ preview }}</pre>
          </div>
          <div v-else class="text-center py-8 text-muted-foreground">
            点击"生成预览"查看变更
          </div>
          <Button
            v-if="!previewLoading"
            variant="outline"
            class="w-full mt-4"
            @click="handlePreview"
          >
            生成预览
          </Button>
        </TabsContent>

        <!-- YAML 标签 -->
        <TabsContent value="yaml" class="mt-4">
          <div class="space-y-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>YAML 配置</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="handleValidateYAML"
                  :disabled="validating"
                >
                  <Loader2 v-if="validating" class="h-4 w-4 mr-2 animate-spin" />
                  <CheckCircle v-else class="h-4 w-4 mr-2" />
                  验证
                </Button>
              </div>
              <Textarea
                v-model="yamlContent"
                class="font-mono text-sm min-h-[300px]"
                placeholder="粘贴或编辑 YAML 配置..."
              />
            </div>
            <Alert v-if="yamlValidation" :variant="yamlValidation.valid ? 'default' : 'destructive'">
              <AlertCircle class="h-4 w-4" />
              <AlertTitle>
                {{ yamlValidation.valid ? '验证通过' : '验证失败' }}
              </AlertTitle>
              <AlertDescription v-if="!yamlValidation.valid">
                {{ yamlValidation.error }}
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
      </Tabs>

      <div class="space-y-4 pt-4 border-t">
        <div class="space-y-2">
          <Label for="commitMessage">提交信息</Label>
          <Textarea
            id="commitMessage"
            v-model="commitMessage"
            placeholder="描述本次配置变更..."
            rows="3"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">
          取消
        </Button>
        <Button
          :disabled="loading || !canDeploy"
          @click="handleDeploy"
        >
          <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
          <GitCommit class="mr-2 h-4 w-4" />
          提交并部署
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGitOps } from '@/composables/useGitOps'
import { log } from '@juanie/ui'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@juanie/ui'
import {
  AlertCircle,
  CheckCircle,
  GitCommit,
  Loader2,
  Plus,
  X,
} from 'lucide-vue-next'

interface Props {
  open: boolean
  projectId: string
  environmentId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'deployed': []
}>()

const { deployWithGitOps } = useGitOps()

const activeTab = ref('config')
const loading = ref(false)
const previewLoading = ref(false)
const validating = ref(false)
const preview = ref<any>(null)
const yamlContent = ref('')
const yamlValidation = ref<any>(null)
const commitMessage = ref('')

const formData = ref({
  image: '',
  replicas: 1,
  env: [] as Array<{ name: string; value: string }>,
  resources: {
    limits: {
      cpu: '',
      memory: '',
    },
    requests: {
      cpu: '',
      memory: '',
    },
  },
})

const canDeploy = computed(() => {
  return !!(
    (formData.value.image || yamlContent.value) &&
    commitMessage.value
  )
})

const addEnv = () => {
  formData.value.env.push({ name: '', value: '' })
}

const removeEnv = (index: number) => {
  formData.value.env.splice(index, 1)
}

const handlePreview = async () => {
  previewLoading.value = true
  try {
    // TODO: 后端需要实现 previewChanges API
    const changes = yamlContent.value || formData.value
    preview.value = JSON.stringify(changes, null, 2)
    log.warn('previewChanges API not implemented, showing local preview')
  } catch (error) {
    log.error('Failed to preview changes:', error)
  } finally {
    previewLoading.value = false
  }
}

const handleValidateYAML = async () => {
  if (!yamlContent.value) return

  validating.value = true
  try {
    // TODO: 后端需要实现 validateYAML API
    // 简单的本地验证
    try {
      JSON.parse(yamlContent.value)
      yamlValidation.value = { valid: true }
    } catch {
      yamlValidation.value = { valid: false, error: 'Invalid JSON format' }
    }
    log.warn('validateYAML API not implemented, using local validation')
  } catch (error) {
    log.error('Failed to validate YAML:', error)
  } finally {
    validating.value = false
  }
}

const handleDeploy = async () => {
  loading.value = true
  try {
    const changes = yamlContent.value ? JSON.parse(yamlContent.value) : formData.value
    await deployWithGitOps({
      projectId: props.projectId,
      environmentId: props.environmentId,
      changes,
      commitMessage: commitMessage.value,
    })

    emit('deployed')
    emit('update:open', false)

    // 重置表单
    formData.value = {
      image: '',
      replicas: 1,
      env: [],
      resources: {
        limits: { cpu: '', memory: '' },
        requests: { cpu: '', memory: '' },
      },
    }
    yamlContent.value = ''
    commitMessage.value = ''
    preview.value = null
    yamlValidation.value = null
  } catch (error) {
    log.error('Failed to deploy:', error)
  } finally {
    loading.value = false
  }
}

// 重置表单当对话框关闭时
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    activeTab.value = 'config'
    preview.value = null
    yamlValidation.value = null
  }
})
</script>
