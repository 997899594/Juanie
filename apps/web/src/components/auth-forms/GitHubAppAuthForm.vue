<template>
  <Card>
    <CardHeader>
      <CardTitle>GitHub App 认证</CardTitle>
      <CardDescription>
        使用 GitHub App 进行组织级别的认证
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <Alert>
          <InfoIcon class="h-4 w-4" />
          <AlertTitle>配置要求</AlertTitle>
          <AlertDescription>
            需要先在 GitHub 组织中创建并安装 App
          </AlertDescription>
        </Alert>

        <div class="space-y-2">
          <Label for="appId">App ID</Label>
          <Input
            id="appId"
            v-model="form.appId"
            placeholder="123456"
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="installationId">Installation ID</Label>
          <Input
            id="installationId"
            v-model="form.installationId"
            placeholder="789012"
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="privateKey">Private Key</Label>
          <Textarea
            id="privateKey"
            v-model="form.privateKey"
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
            rows="6"
            required
          />
          <p class="text-xs text-muted-foreground">
            粘贴完整的私钥内容
          </p>
        </div>

        <Button type="submit" :disabled="loading || !isFormValid">
          <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
          保存配置
        </Button>
      </form>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Input } from '@juanie/ui'
import { Label } from '@juanie/ui'
import { Textarea } from '@juanie/ui'
import { Alert, AlertDescription, AlertTitle } from '@juanie/ui'
import { InfoIcon, Loader2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

interface Props {
  projectId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  success: []
}>()

const { toast } = useToast()
const loading = ref(false)

const form = ref({
  appId: '',
  installationId: '',
  privateKey: '',
})

const isFormValid = computed(() => {
  return form.value.appId && form.value.installationId && form.value.privateKey
})

async function handleSubmit() {
  loading.value = true

  try {
    await trpc.gitops.createGitHubAppCredential.mutate({
      projectId: props.projectId,
      appId: form.value.appId,
      installationId: form.value.installationId,
      privateKey: form.value.privateKey,
    })

    toast({
      title: '配置成功',
      description: 'GitHub App 凭证已保存',
    })

    emit('success')
  } catch (error: any) {
    toast({
      title: '配置失败',
      description: error.message,
      variant: 'destructive',
    })
  } finally {
    loading.value = false
  }
}
</script>
