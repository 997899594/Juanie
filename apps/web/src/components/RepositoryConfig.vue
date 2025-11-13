<template>
  <div class="space-y-6">
    <!-- <div class="text-center space-y-2">
      <h3 class="text-lg font-semibold">配置 Git 仓库</h3>
      <p class="text-muted-foreground">
        选择关联现有仓库或创建新仓库来存储项目配置
      </p>
    </div> -->

    <!-- 模式选择 -->
    <Tabs v-model="repositoryMode" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="existing">
          <GitBranch class="mr-2 h-4 w-4" />
          关联现有仓库
        </TabsTrigger>
        <TabsTrigger value="create">
          <Plus class="mr-2 h-4 w-4" />
          创建新仓库
        </TabsTrigger>
      </TabsList>

      <!-- 关联现有仓库 -->
      <TabsContent value="existing" class="space-y-4 mt-6">
        <Alert>
          <Info class="h-4 w-4" />
          <AlertDescription>
            我们将在您的仓库中创建 k8s 配置目录，并提交初始配置文件
          </AlertDescription>
        </Alert>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="provider">Git 提供商 *</Label>
            <Select v-model="existingRepo.provider">
              <SelectTrigger id="provider">
                <SelectValue placeholder="选择 Git 提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">
                  <div class="flex items-center">
                    <Github class="mr-2 h-4 w-4" />
                    GitHub
                  </div>
                </SelectItem>
                <SelectItem value="gitlab">
                  <div class="flex items-center">
                    <Gitlab class="mr-2 h-4 w-4" />
                    GitLab
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="repo-url">仓库 URL *</Label>
            <Input
              id="repo-url"
              v-model="existingRepo.url"
              placeholder="https://github.com/username/repo"
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
            <Label for="access-token">
              访问令牌
              <Badge v-if="hasCurrentProviderOAuth && useOAuthToken" variant="outline" class="ml-2">
                <LinkIcon class="mr-1 h-3 w-3" />
                使用已连接账户
              </Badge>
            </Label>
            
            <Alert v-if="hasCurrentProviderOAuth" class="mb-2 items-start">
              <CheckCircle2 class="h-4 w-4 mt-0.5" />
              <AlertDescription class="flex-1">
                <div class="flex items-center justify-between gap-4">
                  <span>已检测到您的 {{ existingRepo.provider === 'github' ? 'GitHub' : 'GitLab' }} 账户连接</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="flex-shrink-0"
                    @click="useOAuthToken = !useOAuthToken"
                  >
                    {{ useOAuthToken ? '手动输入令牌' : '使用已连接账户' }}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <Input
              v-if="!hasCurrentProviderOAuth || !useOAuthToken"
              id="access-token"
              v-model="existingRepo.accessToken"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
            />
            <p v-if="!hasCurrentProviderOAuth || !useOAuthToken" class="text-xs text-muted-foreground">
              需要 repo 权限的个人访问令牌
              <a
                :href="getTokenHelpUrl(existingRepo.provider)"
                target="_blank"
                class="text-primary hover:underline"
              >
                如何创建？
              </a>
            </p>
            <p v-else class="text-xs text-muted-foreground">
              将使用您已授权的 {{ existingRepo.provider === 'github' ? 'GitHub' : 'GitLab' }} 账户访问仓库
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

          <Button
            variant="outline"
            class="w-full"
            @click="testConnection"
            :disabled="!canTestConnection || testing"
          >
            <Loader2 v-if="testing" class="mr-2 h-4 w-4 animate-spin" />
            <CheckCircle2 v-else class="mr-2 h-4 w-4" />
            测试连接
          </Button>

          <Alert v-if="connectionStatus" :variant="connectionStatus.success ? 'default' : 'destructive'">
            <CheckCircle2 v-if="connectionStatus.success" class="h-4 w-4" />
            <AlertCircle v-else class="h-4 w-4" />
            <AlertDescription>
              {{ connectionStatus.message }}
            </AlertDescription>
          </Alert>
        </div>
      </TabsContent>

      <!-- 创建新仓库 -->
      <TabsContent value="create" class="space-y-4 mt-6">
        <Alert>
          <Info class="h-4 w-4" />
          <AlertDescription>
            我们将在您的 {{ newRepo.provider === 'github' ? 'GitHub' : 'GitLab' }} 账户中创建新仓库，并初始化项目配置
          </AlertDescription>
        </Alert>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="new-provider">Git 提供商 *</Label>
            <Select v-model="newRepo.provider">
              <SelectTrigger id="new-provider">
                <SelectValue placeholder="选择 Git 提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">
                  <div class="flex items-center">
                    <Github class="mr-2 h-4 w-4" />
                    GitHub
                  </div>
                </SelectItem>
                <SelectItem value="gitlab">
                  <div class="flex items-center">
                    <Gitlab class="mr-2 h-4 w-4" />
                    GitLab
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="repo-name">仓库名称 *</Label>
            <Input
              id="repo-name"
              v-model="newRepo.name"
              :placeholder="projectName ? `${projectName.toLowerCase().replace(/\s+/g, '-')}` : 'my-project'"
            />
            <p class="text-xs text-muted-foreground">
              只能包含字母、数字、连字符和下划线
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

          <div class="space-y-2">
            <Label for="new-access-token">
              访问令牌
              <Badge v-if="hasCurrentProviderOAuth && useOAuthToken" variant="outline" class="ml-2">
                <LinkIcon class="mr-1 h-3 w-3" />
                使用已连接账户
              </Badge>
            </Label>
            
            <Alert v-if="hasCurrentProviderOAuth" class="mb-2 items-start">
              <CheckCircle2 class="h-4 w-4 mt-0.5" />
              <AlertDescription class="flex-1">
                <div class="flex items-center justify-between gap-4">
                  <span>已检测到您的 {{ newRepo.provider === 'github' ? 'GitHub' : 'GitLab' }} 账户连接</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="flex-shrink-0"
                    @click="useOAuthToken = !useOAuthToken"
                  >
                    {{ useOAuthToken ? '手动输入令牌' : '使用已连接账户' }}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <Input
              v-if="!hasCurrentProviderOAuth || !useOAuthToken"
              id="new-access-token"
              v-model="newRepo.accessToken"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
            />
            <p v-if="!hasCurrentProviderOAuth || !useOAuthToken" class="text-xs text-muted-foreground">
              需要创建仓库权限的个人访问令牌
              <a
                :href="getTokenHelpUrl(newRepo.provider)"
                target="_blank"
                class="text-primary hover:underline"
              >
                如何创建？
              </a>
            </p>
            <p v-else class="text-xs text-muted-foreground">
              将使用您已授权的 {{ newRepo.provider === 'github' ? 'GitHub' : 'GitLab' }} 账户创建仓库
            </p>
          </div>

          <div class="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div class="flex items-start space-x-3">
              <Checkbox
                id="include-app-code"
                v-model:checked="newRepo.includeAppCode"
                class="mt-1"
              />
              <div class="flex-1">
                <Label
                  for="include-app-code"
                  class="text-sm font-medium cursor-pointer"
                >
                  生成应用代码模板
                </Label>
                <p class="text-xs text-muted-foreground mt-1">
                  根据您选择的项目模板（如 Node.js、Python 等）自动生成对应的应用代码框架
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <Sparkles class="h-4 w-4" />
            <AlertDescription>
              <p class="font-medium mb-1">仓库将自动包含：</p>
              <ul class="text-sm space-y-1 ml-4 list-disc">
                <li>README.md - 项目说明文档</li>
                <li>.gitignore - Git 忽略规则</li>
                <li>Kubernetes 配置文件 - 部署配置</li>
                <li v-if="newRepo.includeAppCode">应用代码模板 - 可直接运行的示例代码</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </TabsContent>
    </Tabs>

    <!-- 提示信息 -->
    <Alert class="mt-4">
      <Info class="h-4 w-4" />
      <AlertDescription>
        <p class="text-sm">
          <strong>提示：</strong>Git 仓库配置是可选的，不填写可直接进入下一步。
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          <span class="text-orange-600 font-medium">注意：</span>没有 Git 仓库将无法使用 GitOps 自动部署功能，稍后可在项目设置中添加。
        </p>
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Label,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  Checkbox,
  Badge,
} from '@juanie/ui'
import {
  GitBranch,
  Plus,
  Info,
  Github,
  Gitlab,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Globe,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

const props = defineProps<{
  modelValue: any
  projectName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'update:canProceed': [value: boolean]
}>()

const toast = useToast()

// 状态
const repositoryMode = ref<'existing' | 'create'>('existing')
const testing = ref(false)
const urlError = ref<string | null>(null)
const connectionStatus = ref<{ success: boolean; message: string } | null>(null)
const loadingOAuthAccounts = ref(false)
const oauthAccounts = ref<Array<{ provider: string }>>([])
const useOAuthToken = ref(true) // 默认使用 OAuth 令牌

// 关联现有仓库
const existingRepo = ref({
  provider: 'github' as 'github' | 'gitlab',
  url: '',
  accessToken: '',
  defaultBranch: '',
})

// 创建新仓库
const newRepo = ref({
  provider: 'github' as 'github' | 'gitlab',
  name: '',
  visibility: 'private' as 'private' | 'public',
  accessToken: '',
  includeAppCode: false,
})

// 计算属性
const canTestConnection = computed(() => {
  return existingRepo.value.provider &&
    existingRepo.value.url &&
    existingRepo.value.accessToken &&
    !urlError.value
})

// 验证仓库 URL
function validateRepoUrl() {
  const url = existingRepo.value.url.trim()
  if (!url) {
    urlError.value = null
    return
  }

  // 支持 HTTPS 和 SSH 格式
  const httpsPattern = /^https:\/\/(github\.com|gitlab\.com)\/[\w-]+\/[\w.-]+$/
  const sshPattern = /^git@(github\.com|gitlab\.com):[\w-]+\/[\w.-]+\.git$/

  if (!httpsPattern.test(url) && !sshPattern.test(url)) {
    urlError.value = '无效的仓库 URL 格式'
  } else {
    urlError.value = null
  }
}

// 测试连接
async function testConnection() {
  testing.value = true
  connectionStatus.value = null

  try {
    // 模拟测试连接
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 这里应该调用实际的 API 来测试连接
    // const result = await trpc.repositories.testConnection.query({
    //   provider: existingRepo.value.provider,
    //   url: existingRepo.value.url,
    //   accessToken: existingRepo.value.accessToken,
    // })

    connectionStatus.value = {
      success: true,
      message: '连接成功！仓库访问正常',
    }
  } catch (error: any) {
    connectionStatus.value = {
      success: false,
      message: error.message || '连接失败，请检查 URL 和访问令牌',
    }
  } finally {
    testing.value = false
  }
}

// 获取令牌帮助链接
function getTokenHelpUrl(provider: string): string {
  if (provider === 'github') {
    return 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'
  }
  return 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html'
}

// 始终允许继续（仓库配置是可选的）
watch(
  () => true,
  () => {
    emit('update:canProceed', true)
  },
  { immediate: true }
)

// 监听变化并更新父组件
watch(
  [repositoryMode, existingRepo, newRepo],
  () => {
    // 检查是否填写了必要信息并构建配置
    let config: any = null

    if (repositoryMode.value === 'existing') {
      if (existingRepo.value.url && existingRepo.value.provider) {
        config = {
          mode: 'existing',
          provider: existingRepo.value.provider,
          url: existingRepo.value.url,
          accessToken: (hasCurrentProviderOAuth.value && useOAuthToken.value) 
            ? '__USE_OAUTH__'
            : existingRepo.value.accessToken,
          defaultBranch: existingRepo.value.defaultBranch || undefined,
        }
      }
    } else {
      if (newRepo.value.name && newRepo.value.provider) {
        config = {
          mode: 'create',
          provider: newRepo.value.provider,
          name: newRepo.value.name,
          visibility: newRepo.value.visibility,
          accessToken: (hasCurrentProviderOAuth.value && useOAuthToken.value)
            ? '__USE_OAUTH__'
            : newRepo.value.accessToken,
          includeAppCode: newRepo.value.includeAppCode,
        }
      }
    }

    // 不填写就返回 null（表示跳过）
    emit('update:modelValue', config)
  },
  { deep: true, immediate: true }
)

// 加载用户的 OAuth 账户
async function loadOAuthAccounts() {
  loadingOAuthAccounts.value = true
  try {
    oauthAccounts.value = await trpc.users.oauthAccounts.list.query()
  } catch (error: any) {
    console.error('Failed to load OAuth accounts:', error)
  } finally {
    loadingOAuthAccounts.value = false
  }
}

// 检查是否已连接指定提供商
const hasGitHubOAuth = computed(() => 
  oauthAccounts.value.some(acc => acc.provider === 'github')
)

const hasGitLabOAuth = computed(() => 
  oauthAccounts.value.some(acc => acc.provider === 'gitlab')
)

// 检查当前选择的提供商是否已连接 OAuth
const hasCurrentProviderOAuth = computed(() => {
  if (repositoryMode.value === 'existing') {
    return existingRepo.value.provider === 'github' ? hasGitHubOAuth.value : hasGitLabOAuth.value
  } else {
    return newRepo.value.provider === 'github' ? hasGitHubOAuth.value : hasGitLabOAuth.value
  }
})

// 组件挂载时加载 OAuth 账户
onMounted(async () => {
  await loadOAuthAccounts()
  
  // 自动选择已连接的提供商
  if (oauthAccounts.value.length > 0 && oauthAccounts.value[0]) {
    const firstProvider = oauthAccounts.value[0].provider as 'github' | 'gitlab'
    existingRepo.value.provider = firstProvider
    newRepo.value.provider = firstProvider
  }
})
</script>
