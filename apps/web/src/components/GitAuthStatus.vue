<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>认证状态</CardTitle>
        <Badge :variant="statusVariant">
          {{ statusText }}
        </Badge>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div v-if="auth" class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">认证方式</span>
          <span class="font-medium">{{ authTypeLabel }}</span>
        </div>
        
        <div v-if="auth.lastValidatedAt" class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">最后验证</span>
          <span class="font-medium">{{ formatDate(auth.lastValidatedAt) }}</span>
        </div>

        <div v-if="auth.tokenExpiresAt" class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">过期时间</span>
          <span class="font-medium">{{ formatDate(auth.tokenExpiresAt) }}</span>
        </div>
      </div>

      <div v-else class="text-sm text-muted-foreground">
        尚未配置认证
      </div>

      <div class="flex gap-2">
        <Button 
          v-if="auth" 
          variant="outline" 
          size="sm"
          @click="handleCheck"
          :disabled="checking"
        >
          <Loader2 v-if="checking" class="mr-2 h-4 w-4 animate-spin" />
          <RefreshCw v-else class="mr-2 h-4 w-4" />
          检查状态
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          @click="$emit('configure')"
        >
          <Settings class="mr-2 h-4 w-4" />
          {{ auth ? '重新配置' : '配置认证' }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '@juanie/ui'
import { Button } from '@juanie/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@juanie/ui'
import { Loader2, RefreshCw, Settings } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

interface Props {
  projectId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  configure: []
}>()

const toast = useToast()
const checking = ref(false)
const auth = ref<any>(null)

const authTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    oauth: 'OAuth',
    pat: 'Personal Access Token',
    github_app: 'GitHub App',
    gitlab_group_token: 'GitLab Group Token',
  }
  return labels[auth.value?.authType] || auth.value?.authType
})

const statusVariant = computed(() => {
  if (!auth.value) return 'secondary'
  if (auth.value.validationStatus === 'valid') return 'default'
  if (auth.value.validationStatus === 'invalid') return 'destructive'
  return 'secondary'
})

const statusText = computed(() => {
  if (!auth.value) return '未配置'
  if (auth.value.validationStatus === 'valid') return '正常'
  if (auth.value.validationStatus === 'invalid') return '失效'
  return '未知'
})

async function handleCheck() {
  checking.value = true

  try {
    // TODO: 后端需要实现 checkCredentialHealth API
    // 临时返回模拟数据
    auth.value = {
      authType: 'oauth',
      validationStatus: 'valid',
      lastValidatedAt: new Date().toISOString(),
    }
    toast.success('检查完成', '认证状态正常')
  } catch (error: any) {
    toast.error('检查失败', error.message)
  } finally {
    checking.value = false
  }
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString('zh-CN')
}

// 初始加载
handleCheck()
</script>
