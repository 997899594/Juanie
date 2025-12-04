<template>
  <Card>
    <CardHeader>
      <CardTitle>Personal Access Token</CardTitle>
      <CardDescription>
        使用 {{ provider }} Personal Access Token 进行认证
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="token">Access Token</Label>
          <Input
            id="token"
            v-model="form.token"
            type="password"
            placeholder="ghp_xxxxxxxxxxxx 或 glpat-xxxxxxxxxxxx"
            required
          />
          <p class="text-xs text-muted-foreground">
            Token 将被加密存储
          </p>
        </div>

        <div class="space-y-2">
          <Label for="scopes">权限范围（可选）</Label>
          <Input
            id="scopes"
            v-model="scopesInput"
            placeholder="repo, workflow"
          />
          <p class="text-xs text-muted-foreground">
            多个权限用逗号分隔
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

        <div class="flex gap-2">
          <Button type="submit" :disabled="loading || !form.token">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            保存配置
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            @click="testToken" 
            :disabled="!form.token || loading"
          >
            测试连接
          </Button>
        </div>
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
import { Loader2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

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

const form = ref({
  token: '',
  expiresAt: '',
})

const scopesInput = ref('')

const scopes = computed(() => {
  return scopesInput.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
})

async function handleSubmit() {
  loading.value = true

  try {
    await trpc.gitops.createPATCredential.mutate({
      projectId: props.projectId,
      token: form.value.token,
      provider: props.provider,
      scopes: scopes.value.length > 0 ? scopes.value : undefined,
      expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt) : undefined,
    })

    toast.success('配置成功', 'PAT 凭证已保存')

    emit('success')
  } catch (error: any) {
    toast.error('配置失败', error.message)
  } finally {
    loading.value = false
  }
}

async function testToken() {
  loading.value = true

  try {
    const apiUrl = props.provider === 'github' 
      ? 'https://api.github.com/user'
      : 'https://gitlab.com/api/v4/user'

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${form.value.token}`,
      },
    })

    if (response.ok) {
      toast.success('测试成功', 'Token 有效')
    } else {
      toast.error('测试失败', `API 返回错误: ${response.status}`)
    }
  } catch (error: any) {
    toast.error('测试失败', error.message)
  } finally {
    loading.value = false
  }
}
</script>
