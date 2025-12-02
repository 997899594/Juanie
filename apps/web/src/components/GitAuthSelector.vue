<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">Git 认证配置</h3>
      <Badge v-if="currentAuth" :variant="authStatus === 'valid' ? 'default' : 'destructive'">
        {{ authStatus === 'valid' ? '已配置' : '需要配置' }}
      </Badge>
    </div>

    <!-- 工作空间上下文提示 -->
    <Alert>
      <InfoIcon class="h-4 w-4" />
      <AlertTitle>当前工作空间</AlertTitle>
      <AlertDescription>
        {{ workspaceContext }}
        <span v-if="recommendedAuthType" class="block mt-1 text-sm">
          推荐使用: <strong>{{ recommendedAuthType.label }}</strong>
        </span>
      </AlertDescription>
    </Alert>

    <!-- 认证方式选择 -->
    <div class="space-y-2">
      <Label>选择认证方式</Label>
      <Select v-model="selectedAuthType">
        <SelectTrigger>
          <SelectValue placeholder="选择认证方式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem 
            v-for="option in authOptions" 
            :key="option.value" 
            :value="option.value"
          >
            <div class="flex items-center gap-2">
              <component :is="option.icon" class="h-4 w-4" />
              <span>{{ option.label }}</span>
              <Badge v-if="option.recommended" variant="secondary" class="ml-2">推荐</Badge>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p class="text-sm text-muted-foreground">
        {{ currentDescription }}
      </p>
    </div>

    <!-- 动态表单 -->
    <component 
      :is="currentFormComponent" 
      v-if="selectedAuthType"
      :project-id="projectId"
      @success="handleSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Alert, AlertDescription, AlertTitle } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Label } from '@juanie/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@juanie/ui'
import { InfoIcon, KeyRound, Github, GitlabIcon, Shield } from 'lucide-vue-next'
import { useWorkspaceStore } from '@/stores/workspace'
import OAuthAuthForm from './auth-forms/OAuthAuthForm.vue'
import PATAuthForm from './auth-forms/PATAuthForm.vue'
import GitHubAppAuthForm from './auth-forms/GitHubAppAuthForm.vue'
import GitLabGroupAuthForm from './auth-forms/GitLabGroupAuthForm.vue'

interface Props {
  projectId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  success: []
}>()

const workspaceStore = useWorkspaceStore()
const { currentWorkspace, isPersonal, isOrganization, workspaceContext, recommendedAuthType } = storeToRefs(workspaceStore)

const selectedAuthType = ref<string>('')
const currentAuth = ref(null)
const authStatus = ref<'valid' | 'invalid' | 'unknown'>('unknown')

// 从工作空间获取 provider
const provider = computed(() => currentWorkspace.value?.provider || 'github')

// 认证选项 - 根据工作空间自动生成
const authOptions = computed(() => {
  const options = []

  // 个人工作空间
  if (isPersonal.value) {
    options.push({
      value: 'oauth',
      label: 'OAuth 认证',
      icon: Shield,
      recommended: true,
      description: '简单便捷，一键授权，适合个人项目'
    })
  }

  // 组织工作空间
  if (isOrganization.value) {
    if (provider.value === 'github') {
      options.push({
        value: 'github_app',
        label: 'GitHub App',
        icon: Github,
        recommended: true,
        description: '组织级别权限控制，最佳安全性'
      })
    } else {
      options.push({
        value: 'gitlab_group_token',
        label: 'GitLab Group Token',
        icon: GitlabIcon,
        recommended: true,
        description: '组级别管理，支持多项目共享'
      })
    }
  }

  // PAT - 始终可用作为备选
  options.push({
    value: 'pat',
    label: 'Personal Access Token',
    icon: KeyRound,
    recommended: false,
    description: '细粒度权限控制，需要手动管理'
  })

  return options
})

// 当前描述
const currentDescription = computed(() => {
  const option = authOptions.value.find(o => o.value === selectedAuthType.value)
  return option?.description || '请选择认证方式'
})

// 动态表单组件
const currentFormComponent = computed(() => {
  switch (selectedAuthType.value) {
    case 'oauth':
      return OAuthAuthForm
    case 'pat':
      return PATAuthForm
    case 'github_app':
      return GitHubAppAuthForm
    case 'gitlab_group_token':
      return GitLabGroupAuthForm
    default:
      return null
  }
})

// 自动选择推荐方式 - 基于工作空间
watch([() => authOptions.value, recommendedAuthType], ([options, recommended]) => {
  if (!selectedAuthType.value && recommended) {
    selectedAuthType.value = recommended.type
  } else if (!selectedAuthType.value && options.length > 0) {
    const recommendedOption = options.find(o => o.recommended)
    selectedAuthType.value = recommendedOption?.value || options[0].value
  }
}, { immediate: true })

function handleSuccess() {
  emit('success')
}
</script>
