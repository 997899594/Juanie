<template>
  <Card>
    <CardHeader>
      <CardTitle>OAuth 认证</CardTitle>
      <CardDescription>
        使用你的 {{ provider }} 账户一键授权
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <Alert>
        <InfoIcon class="h-4 w-4" />
        <AlertTitle>简单快速</AlertTitle>
        <AlertDescription>
          点击下方按钮，跳转到 {{ provider }} 授权页面，授权后自动完成配置
        </AlertDescription>
      </Alert>

      <Button @click="handleOAuth" :disabled="loading" class="w-full">
        <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
        <component :is="providerIcon" v-else class="mr-2 h-4 w-4" />
        使用 {{ provider }} 授权
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Alert, AlertDescription, AlertTitle } from '@juanie/ui'
import { Github, GitlabIcon, InfoIcon, Loader2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

interface Props {
  projectId: string
  provider?: 'github' | 'gitlab'
}

const props = withDefaults(defineProps<Props>(), {
  provider: 'github'
})

const emit = defineEmits<{
  success: []
}>()

const toast = useToast()
const loading = ref(false)

const providerIcon = computed(() => {
  return props.provider === 'github' ? Github : GitlabIcon
})

async function handleOAuth() {
  loading.value = true
  
  try {
    // 跳转到 OAuth 授权页面
    const redirectUrl = `/api/auth/${props.provider}/authorize?projectId=${props.projectId}`
    window.location.href = redirectUrl
  } catch (error: any) {
    toast.error('授权失败', error.message)
    loading.value = false
  }
}
</script>
