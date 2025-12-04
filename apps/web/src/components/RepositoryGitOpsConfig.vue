<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>GitOps 配置</DialogTitle>
        <DialogDescription>
          为仓库 {{ repository?.fullName }} 配置 GitOps 自动同步
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- 启用状态 -->
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>启用 GitOps</Label>
            <p class="text-sm text-muted-foreground">
              通过 Flux 自动同步仓库配置到 Kubernetes
            </p>
          </div>
          <Switch
            :checked="formData.enabled"
            @update:checked="formData.enabled = $event"
          />
        </div>

        <template v-if="formData.enabled">
          <Separator />

          <!-- Flux 命名空间 -->
          <div class="space-y-2">
            <Label for="fluxNamespace">Flux 命名空间</Label>
            <Input
              id="fluxNamespace"
              v-model="formData.fluxNamespace"
              placeholder="flux-system"
            />
            <p class="text-xs text-muted-foreground">
              Flux 资源所在的 Kubernetes 命名空间
            </p>
          </div>

          <!-- Flux 资源名称 -->
          <div class="space-y-2">
            <Label for="fluxResourceName">Flux 资源名称</Label>
            <Input
              id="fluxResourceName"
              v-model="formData.fluxResourceName"
              :placeholder="defaultResourceName"
            />
            <p class="text-xs text-muted-foreground">
              GitRepository 资源的名称
            </p>
          </div>

          <!-- 同步间隔 -->
          <div class="space-y-2">
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
                <SelectItem value="30m">30 分钟</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Flux 检查仓库更新的频率
            </p>
          </div>

          <!-- Secret 引用 -->
          <div class="space-y-2">
            <Label for="secretRef">Secret 引用（可选）</Label>
            <Input
              id="secretRef"
              v-model="formData.secretRef"
              placeholder="git-credentials"
            />
            <p class="text-xs text-muted-foreground">
              用于访问私有仓库的 Kubernetes Secret 名称
            </p>
          </div>

          <!-- 超时时间 -->
          <div class="space-y-2">
            <Label for="timeout">超时时间</Label>
            <Input
              id="timeout"
              v-model="formData.timeout"
              placeholder="60s"
            />
            <p class="text-xs text-muted-foreground">
              Git 操作的超时时间
            </p>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="$emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          :disabled="loading"
          @click="handleSave"
        >
          <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
          保存配置
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  repository: any
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { enableGitOps, disableGitOps } = useRepositories()
const loading = ref(false)

// 表单数据
const formData = ref({
  enabled: false,
  fluxNamespace: 'flux-system',
  fluxResourceName: '',
  syncInterval: '1m',
  secretRef: '',
  timeout: '60s',
})

// 默认资源名称
const defaultResourceName = computed(() => {
  if (!props.repository) return ''
  return props.repository.fullName.replace('/', '-')
})

// 监听仓库变化，初始化表单
watch(() => props.repository, (repo) => {
  if (repo) {
    const config = repo.gitopsConfig
    formData.value = {
      enabled: config?.enabled || false,
      fluxNamespace: config?.fluxNamespace || 'flux-system',
      fluxResourceName: config?.fluxResourceName || defaultResourceName.value,
      syncInterval: config?.syncInterval || '1m',
      secretRef: config?.secretRef || '',
      timeout: config?.timeout || '60s',
    }
  }
}, { immediate: true })

// 保存配置
const handleSave = async () => {
  if (!props.repository) return

  loading.value = true
  try {
    if (formData.value.enabled) {
      // 启用 GitOps
      await enableGitOps({
        repositoryId: props.repository.id,
        config: {
          fluxNamespace: formData.value.fluxNamespace,
          fluxResourceName: formData.value.fluxResourceName || defaultResourceName.value,
          syncInterval: formData.value.syncInterval,
          secretRef: formData.value.secretRef || undefined,
          timeout: formData.value.timeout,
        },
      })
    } else {
      // 禁用 GitOps
      await disableGitOps({
        repositoryId: props.repository.id,
      })
    }

    emit('saved')
    emit('update:open', false)
  } catch (error) {
    log.error('Failed to save GitOps config:', error)
  } finally {
    loading.value = false
  }
}
</script>
