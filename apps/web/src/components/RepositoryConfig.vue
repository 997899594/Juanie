<template>
  <div class="space-y-6">
    <!-- <div v-if="props.required" class="text-sm text-muted-foreground">
      <p class="flex items-center gap-2">
        <span class="text-destructive">*</span>
        <span>Git 仓库是必需的，请选择创建新仓库或关联现有仓库</span>
      </p>
    </div> -->

    <!-- 加载状态 -->
    <div v-if="loadingAccounts" class="flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin text-primary" />
      <span class="ml-2 text-sm text-muted-foreground">加载账户信息...</span>
    </div>

    <!-- 如果没有已连接的账户 -->
    <Alert v-else-if="!selectedProvider?.connected">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>需要连接 Git 账户</AlertTitle>
      <AlertDescription>
        <p class="mb-3">请先连接你的 Git 账户以创建仓库</p>
        <div class="flex gap-2">
          <Button size="sm" @click="connectGitHub">
            <Github class="mr-2 h-4 w-4" />
            连接 GitHub
          </Button>
          <Button size="sm" variant="outline" @click="connectGitLab">
            <Gitlab class="mr-2 h-4 w-4" />
            连接 GitLab
          </Button>
        </div>
      </AlertDescription>
    </Alert>

    <!-- 仓库配置（只有选择了提供商后才显示） -->
    <div v-if="selectedProvider?.connected">
      <!-- 模式选择 -->
      <Tabs v-model="repositoryMode" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="create">
            <Plus class="mr-2 h-4 w-4" />
            创建新仓库
          </TabsTrigger>
          <TabsTrigger value="existing">
            <GitBranch class="mr-2 h-4 w-4" />
            关联现有仓库
          </TabsTrigger>
        </TabsList>

        <!-- 创建新仓库 -->
        <TabsContent value="create" class="space-y-4 mt-6">
          <Alert>
            <Info class="h-4 w-4" />
            <AlertDescription>
              我们将在您的 {{ selectedProvider.name }} 账户中创建新仓库，并初始化项目配置
            </AlertDescription>
          </Alert>

          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="repo-name">
                仓库名称 *
                <span v-if="isRepoNameAutoFilled" class="text-xs text-muted-foreground font-normal ml-2">
                  (已自动填充，可修改)
                </span>
              </Label>
              <Input
                id="repo-name"
                v-model="newRepo.name"
                placeholder="my-project"
                :class="{ 'border-destructive': newRepo.name && !repoNameValidation.valid }"
                @focus="isRepoNameAutoFilled = false"
              />
              
              <!-- 验证提示 -->
              <div v-if="newRepo.name && !repoNameValidation.valid" class="space-y-2">
                <p class="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle class="h-3 w-3" />
                  {{ repoNameValidation.message }}
                </p>
                <div v-if="repoNameValidation.suggestion" class="flex items-center gap-2">
                  <p class="text-xs text-muted-foreground">
                    建议使用: <code class="px-1.5 py-0.5 bg-muted rounded text-xs">{{ repoNameValidation.suggestion }}</code>
                  </p>
                  <Button size="sm" variant="ghost" class="h-6 text-xs" @click="applySuggestedName">
                    应用
                  </Button>
                </div>
              </div>
              
              <!-- 成功提示 -->
              <p v-else-if="newRepo.name && repoNameValidation.valid && repoNameValidation.message" class="text-xs text-amber-600 flex items-center gap-1">
                <Info class="h-3 w-3" />
                {{ repoNameValidation.message }}
                <Button v-if="repoNameValidation.suggestion" size="sm" variant="ghost" class="h-5 text-xs ml-1" @click="applySuggestedName">
                  (使用 {{ repoNameValidation.suggestion }})
                </Button>
              </p>
              
              <!-- 默认提示 -->
              <p v-else class="text-xs text-muted-foreground">
                只能包含字母、数字、连字符和下划线，不能以连字符开头或结尾
              </p>
            </div>

            <div class="space-y-2">
              <Label for="repo-visibility">仓库可见性 *</Label>
              <Select v-model="newRepo.visibility">
                <SelectTrigger id="repo-visibility">
                  <SelectValue placeholder="选择可见性" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div class="flex items-center">
                      <Lock class="mr-2 h-4 w-4" />
                      私有 - 仅您和协作者可见
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div class="flex items-center">
                      <Globe class="mr-2 h-4 w-4" />
                      公开 - 所有人可见
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <!-- 关联现有仓库 -->
        <TabsContent value="existing" class="space-y-4 mt-6">
          <Alert>
            <Info class="h-4 w-4" />
            <AlertDescription>
              我们将在您的 {{ selectedProvider.name }} 仓库中创建 k8s 配置目录
            </AlertDescription>
          </Alert>

          <div class="space-y-4">
            <!-- 仓库选择 -->
            <div class="space-y-2">
              <Label>选择仓库</Label>
              <Button
                type="button"
                variant="outline"
                class="w-full justify-start"
                :disabled="loadingRepos"
                @click="loadUserRepositories"
              >
                <Loader2 v-if="loadingRepos" class="mr-2 h-4 w-4 animate-spin" />
                <GitBranch v-else class="mr-2 h-4 w-4" />
                {{ selectedRepo ? selectedRepo.fullName : '从您的账户选择仓库' }}
              </Button>

              <!-- 仓库列表 -->
              <div v-if="showRepoList && userRepos.length > 0" class="border rounded-lg max-h-64 overflow-y-auto">
                <button
                  v-for="repo in userRepos"
                  :key="repo.id"
                  type="button"
                  class="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center justify-between"
                  @click="selectRepository(repo)"
                >
                  <div class="flex-1">
                    <div class="font-medium">{{ repo.fullName }}</div>
                    <div class="text-xs text-muted-foreground">{{ repo.url }}</div>
                  </div>
                  <Badge v-if="repo.private" variant="secondary" class="ml-2">私有</Badge>
                </button>
              </div>

              <p v-if="repoError" class="text-xs text-destructive">{{ repoError }}</p>
            </div>

            <!-- 或手动输入 -->
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-background px-2 text-muted-foreground">或手动输入</span>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="repo-url">仓库 URL</Label>
              <Input
                id="repo-url"
                v-model="existingRepo.url"
                :placeholder="`https://${selectedProvider.serverUrl}/username/repo`"
                @blur="validateRepoUrl"
              />
              <p v-if="urlError" class="text-xs text-destructive">
                {{ urlError }}
              </p>
              <p v-else class="text-xs text-muted-foreground">
                支持 HTTPS 和 SSH 格式的 URL
              </p>
            </div>

            <div class="space-y-2">
              <Label for="default-branch">默认分支</Label>
              <Input
                id="default-branch"
                v-model="existingRepo.defaultBranch"
                placeholder="main"
              />
              <p class="text-xs text-muted-foreground">
                留空将使用仓库的默认分支
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Github, Gitlab, AlertCircle, GitBranch, Plus, Info, Lock, Globe, Loader2 } from 'lucide-vue-next'
import { Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label,
  Button,
  Badge,
  Alert,
  AlertDescription,
  AlertTitle , log } from '@juanie/ui'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'
import { validateRepositoryName, sanitizeRepositoryName } from '@/utils/repository'

const props = defineProps<{
  modelValue: any
  projectName?: string
  template?: any
  required?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'update:canProceed': [value: boolean]
}>()

const toast = useToast()

// 获取用户已连接的 OAuth 账户
const oauthAccounts = ref<any[]>([])
const loadingAccounts = ref(true)

// 加载 OAuth 账户
async function loadOAuthAccounts() {
  try {
    oauthAccounts.value = await trpc.users.oauthAccounts.list.query()
    
    // 自动选择第一个已连接的账户
    const connectedProvider = availableProviders.value.find(p => p.connected)
    if (connectedProvider && !selectedProvider.value) {
      selectProvider(connectedProvider)
    }
  } catch (error: any) {
    log.error('Failed to load OAuth accounts:', error)
    toast.error('加载账户失败', error.message)
  } finally {
    loadingAccounts.value = false
  }
}

// 可用的 Git 提供商
const availableProviders = computed(() => {
  const providers: any[] = []

  if (oauthAccounts.value.length === 0) {
    return [
      {
        type: 'github',
        name: 'GitHub',
        serverUrl: 'github.com',
        icon: Github,
        connected: false,
      },
      {
        type: 'gitlab',
        name: 'GitLab',
        serverUrl: 'gitlab.com',
        icon: Gitlab,
        connected: false,
      },
    ]
  }

  // GitHub
  const githubAccount = oauthAccounts.value.find((a: any) => a.provider === 'github')
  if (githubAccount) {
    providers.push({
      type: 'github',
      name: 'GitHub',
      serverUrl: 'github.com',
      icon: Github,
      connected: true,
      account: githubAccount,
    })
  }

  // GitLab 账户（可能有多个）
  const gitlabAccounts = oauthAccounts.value.filter((a: any) => a.provider === 'gitlab')
  for (const account of gitlabAccounts) {
    const serverUrl = account.serverUrl || 'https://gitlab.com'
    const hostname = new URL(serverUrl).hostname

    providers.push({
      type: 'gitlab',
      name:
        account.metadata?.serverName ||
        (hostname === 'gitlab.com' ? 'GitLab' : `GitLab (${hostname})`),
      serverUrl: hostname,
      icon: Gitlab,
      connected: true,
      account,
    })
  }

  // 如果没有连接任何账户，显示可连接的选项
  if (providers.length === 0) {
    providers.push(
      {
        type: 'github',
        name: 'GitHub',
        serverUrl: 'github.com',
        icon: Github,
        connected: false,
      },
      {
        type: 'gitlab',
        name: 'GitLab',
        serverUrl: 'gitlab.com',
        icon: Gitlab,
        connected: false,
      },
    )
  }

  return providers
})

// 状态
const selectedProvider = ref<any>(null)
const repositoryMode = ref<'existing' | 'create'>('create')
const urlError = ref<string | null>(null)
const isRepoNameAutoFilled = ref(false)
const loadingRepos = ref(false)
const showRepoList = ref(false)
const repoError = ref<string | null>(null)
const userRepos = ref<Array<{ id: string; name: string; fullName: string; url: string; private: boolean }>>([])
const selectedRepo = ref<{ id: string; name: string; fullName: string; url: string; private: boolean } | null>(null)

// 关联现有仓库
const existingRepo = ref({
  url: '',
  defaultBranch: '',
})

// 创建新仓库
const newRepo = ref({
  name: '',
  visibility: 'private' as 'private' | 'public',
})

// 仓库名称验证
const repoNameValidation = computed(() => {
  if (!newRepo.value.name) {
    return { valid: false, message: '', suggestion: '' }
  }
  return validateRepositoryName(newRepo.value.name)
})

// 自动应用建议的名称
function applySuggestedName() {
  if (repoNameValidation.value.suggestion) {
    newRepo.value.name = repoNameValidation.value.suggestion
    isRepoNameAutoFilled.value = false
  }
}

// 选择提供商
function selectProvider(provider: any) {
  if (!provider.connected) {
    // 如果未连接，跳转到连接页面
    if (provider.type === 'github') {
      connectGitHub()
    } else if (provider.type === 'gitlab') {
      connectGitLab()
    }
    return
  }

  selectedProvider.value = provider

  // 如果是创建模式，自动填充项目名称
  if (repositoryMode.value === 'create' && props.projectName) {
    newRepo.value.name = props.projectName
    isRepoNameAutoFilled.value = true
  }

  updateModelValue()
}

// 连接 GitHub
function connectGitHub() {
  window.location.href = '/auth/github/connect'
}

// 连接 GitLab
function connectGitLab() {
  window.location.href = '/auth/gitlab/connect'
}

// 加载用户仓库列表
async function loadUserRepositories() {
  if (!selectedProvider.value?.account) {
    return
  }

  loadingRepos.value = true
  repoError.value = null
  showRepoList.value = false

  try {
    userRepos.value = await trpc.repositories.listUserRepositories.query({
      provider: selectedProvider.value.type,
      accessToken: selectedProvider.value.account.accessToken,
    })
    showRepoList.value = true
  } catch (error: any) {
    repoError.value = error.message || '获取仓库列表失败'
    toast.error('获取仓库列表失败', error.message)
  } finally {
    loadingRepos.value = false
  }
}

// 选择仓库
function selectRepository(repo: typeof userRepos.value[0]) {
  selectedRepo.value = repo
  existingRepo.value.url = repo.url
  showRepoList.value = false
  urlError.value = null
}

// 验证仓库 URL
function validateRepoUrl() {
  if (!existingRepo.value.url) {
    urlError.value = null
    return
  }

  const trimmed = existingRepo.value.url.trim().replace(/\.git$/i, '')
  const match = trimmed.match(
    /(?:https?:\/\/|git@)?([^/:]+)(?::|\/)([^/]+\/[^/\s]+)/i,
  )

  if (!match) {
    urlError.value = '仓库 URL 格式不正确'
    return
  }

  urlError.value = null
}

// 更新父组件
function updateModelValue() {
  const value = {
    mode: repositoryMode.value,
    provider: selectedProvider.value?.type,
    selectedAccount: selectedProvider.value?.account,
    name: newRepo.value.name,
    url: existingRepo.value.url,
    // 使用特殊令牌 __USE_OAUTH__ 表示使用 OAuth 账户
    accessToken: selectedProvider.value?.account ? '__USE_OAUTH__' : undefined,
    defaultBranch: existingRepo.value.defaultBranch || 'main',
    visibility: newRepo.value.visibility,
    // 添加服务器信息
    serverUrl: selectedProvider.value?.account?.serverUrl,
    serverType: selectedProvider.value?.account?.serverType,
  }

  emit('update:modelValue', value)

  // 检查是否可以继续
  let canProceed = false

  if (repositoryMode.value === 'create') {
    // 创建模式：需要连接账户、有仓库名称且名称验证通过
    canProceed = !!(
      selectedProvider.value?.connected && 
      newRepo.value.name && 
      repoNameValidation.value.valid
    )
  } else if (repositoryMode.value === 'existing') {
    canProceed = !!(selectedProvider.value?.connected && existingRepo.value.url && !urlError.value)
  }

  emit('update:canProceed', canProceed)
}

// 监听项目名称变化，自动填充仓库名称（并清理）
watch(
  () => props.projectName,
  (newProjectName) => {
    if (newProjectName && repositoryMode.value === 'create' && !newRepo.value.name) {
      // 自动清理项目名称为合法的仓库名称
      newRepo.value.name = sanitizeRepositoryName(newProjectName)
      isRepoNameAutoFilled.value = true
    }
  },
  { immediate: true },
)

// 始终允许继续（仓库配置是可选的）
watch(
  () => true,
  () => {
    emit('update:canProceed', true)
  },
  { immediate: true },
)

// 监听变化并更新父组件
watch(
  [repositoryMode, existingRepo, newRepo, selectedProvider],
  () => {
    updateModelValue()
  },
  { deep: true },
)

// 组件挂载时加载 OAuth 账户
onMounted(() => {
  loadOAuthAccounts()
})
</script>
