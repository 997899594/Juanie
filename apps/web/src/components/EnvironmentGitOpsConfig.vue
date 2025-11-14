<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>环境 GitOps 配置</DialogTitle>
        <DialogDescription>
          为环境 {{ environment?.name }} 配置 GitOps 自动部署
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- 启用状态 -->
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>启用 GitOps</Label>
            <p class="text-sm text-muted-foreground">
              通过 Git 仓库管理环境配置
            </p>
          </div>
          <Switch
            :checked="formData.enabled"
            @update:checked="formData.enabled = $event"
          />
        </div>

        <template v-if="formData.enabled">
          <Separator />

          <!-- 选择仓库 -->
          <div class="space-y-2">
            <Label for="repository">关联仓库</Label>
            <Select v-model="formData.repositoryId">
              <SelectTrigger id="repository">
                <SelectValue placeholder="选择仓库" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="repo in repositories"
                  :key="repo.id"
                  :value="repo.id"
                >
                  {{ repo.fullName }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 分支 -->
          <div class="space-y-2">
            <Label for="branch">分支</Label>
            <Input
              id="branch"
              v-model="formData.branch"
              placeholder="main"
            />
          </div>

          <!-- 路径 -->
          <div class="space-y-2">
            <Label for="path">配置路径</Label>
            <Input
              id="path"
              v-model="formData.path"
              placeholder="environments/production"
            />
            <p class="text-xs text-muted-foreground">
              仓库中存放环境配置的路径
            </p>
          </div>

          <!-- 自动同步 -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>自动同步</Label>
              <p class="text-sm text-muted-foreground">
                自动应用 Git 仓库的变更
              </p>
            </div>
            <Switch
              :checked="formData.autoSync"
              @update:checked="formData.autoSync = $event"
            />
          </div>

          <!-- 同步间隔 -->
          <div v-if="formData.autoSync" class="space-y-2">
            <Label for="syncInterval">同步间隔</Label>
            <Select v-model="formData.syncInterval">
              <SelectTrigger id="syncInterval">
                <SelectValue placeholder="选择同步间隔" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30s">30 秒</SelectItem>
                <SelectItem value="1m">1 分钟</SelectItem>
                <SelectItem value="5m">5 分钟</SelectItem>
                <SelectItem value="10m">10 分钟</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="loading || !canSave" @click="handleSave">
          <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
          保存配置
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useEnvironments } from '@/composables/useEnvironments'
import { useRepositories } from '@/composables/useRepositories'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
} from '@juanie/ui'
import { Loader2 } from 'lucide-vue-next'

interface Props {
  open: boolean
  environment: any
  projectId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { configureGitOps, disableGitOps } = useEnvironments()
const { repositories, fetchRepositories } = useRepositories()
const loading = ref(false)

const formData = ref({
  enabled: false,
  repositoryId: '',
  branch: 'main',
  path: '',
  autoSync: true,
  syncInterval: '1m',
})

const canSave = computed(() => {
  if (!formData.value.enabled) return true
  return !!(
    formData.value.repositoryId &&
    formData.value.branch &&
    formData.value.path
  )
})

watch(() => props.environment, (env) => {
  if (env) {
    const config = env.gitopsConfig
    formData.value = {
      enabled: !!config,
      repositoryId: config?.repositoryId || '',
      branch: config?.branch || 'main',
      path: config?.path || `environments/${env.name.toLowerCase()}`,
      autoSync: config?.autoSync !== false,
      syncInterval: config?.syncInterval || '1m',
    }
  }
}, { immediate: true })

onMounted(async () => {
  if (props.projectId) {
    await fetchRepositories(props.projectId)
  }
})

const handleSave = async () => {
  if (!props.environment) return

  loading.value = true
  try {
    if (formData.value.enabled) {
      await configureGitOps({
        environmentId: props.environment.id,
        config: {
          repositoryId: formData.value.repositoryId,
          branch: formData.value.branch,
          path: formData.value.path,
          autoSync: formData.value.autoSync,
          syncInterval: formData.value.syncInterval,
        },
      })
    } else {
      await disableGitOps({
        environmentId: props.environment.id,
      })
    }

    emit('saved')
    emit('update:open', false)
  } catch (error) {
    console.error('Failed to save GitOps config:', error)
  } finally {
    loading.value = false
  }
}
</script>
