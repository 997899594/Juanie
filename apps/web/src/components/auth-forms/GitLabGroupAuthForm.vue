<template>
  <Card>
    <CardHeader>
      <CardTitle>GitLab Group Token</CardTitle>
      <CardDescription>
        使用 GitLab Group Access Token 进行认证
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <Alert>
          <InfoIcon class="h-4 w-4" />
          <AlertTitle>配置要求</AlertTitle>
          <AlertDescription>
            需要在 GitLab Group 设置中创建 Access Token
          </AlertDescription>
        </Alert>

        <div class="space-y-2">
          <Label for="groupId">Group ID</Label>
          <Input
            id="groupId"
            v-model="form.groupId"
            placeholder="12345"
            required
          />
          <p class="text-xs text-muted-foreground">
            可以在 Group 设置页面找到
          </p>
        </div>

        <div class="space-y-2">
          <Label for="token">Group Access Token</Label>
          <Input
            id="token"
            v-model="form.token"
            type="password"
            placeholder="glpat-xxxxxxxxxxxx"
            required
          />
        </div>

        <div class="space-y-2">
          <Label>权限范围</Label>
          <div class="flex flex-wrap gap-2">
            <Badge 
              v-for="scope in requiredScopes" 
              :key="scope"
              variant="secondary"
            >
              {{ scope }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground">
            Token 需要包含以上权限
          </p>
        </div>

        <div class="space-y-2">
          <Label for="expiresAt">过期时间（可选）</Label>
          <Input
            id="expiresAt"
            v-model="form.expiresAt"
            type="date"
          />
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
import { Badge } from '@juanie/ui'
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
  groupId: '',
  token: '',
  expiresAt: '',
})

const requiredScopes = ['api', 'write_repository']

const isFormValid = computed(() => {
  return form.value.groupId && form.value.token
})

async function handleSubmit() {
  loading.value = true

  try {
    await trpc.gitops.createGitLabGroupTokenCredential.mutate({
      projectId: props.projectId,
      groupId: form.value.groupId,
      token: form.value.token,
      scopes: requiredScopes,
      expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt) : undefined,
    })

    toast({
      title: '配置成功',
      description: 'GitLab Group Token 凭证已保存',
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
