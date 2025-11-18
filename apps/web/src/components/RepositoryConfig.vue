<template>
  <div class="space-y-6">
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
            我们将在您的 {{ userProvider === 'github' ? 'GitHub' : 'GitLab' }} 账户中创建新仓库，并初始化项目配置
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
              @focus="isRepoNameAutoFilled = false"
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
        </div>
      </TabsContent>

      <!-- 关联现有仓库 -->
      <TabsContent value="existing" class="space-y-4 mt-6">
        <Alert>
          <Info class="h-4 w-4" />
          <AlertDescription>
            我们将在您的 {{ userProvider === 'github' ? 'GitHub' : 'GitLab' }} 仓库中创建 k8s 配置目录
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
                @click="selectRepository(repo)"
                class="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center justify-between"
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
              :placeholder="`https://${userProvider === 'github' ? 'github.com' : 'gitlab.com'}/username/repo`"
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
import { ref, watch, onMounted } from 'vue'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  Button,
  Badge,
} from '@juanie/ui'
import {
  GitBranch,
  Plus,
  Info,
  Lock,
  Globe,
  Loader2,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  modelValue: any
  projectName?: string
  template?: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'update:canProceed': [value: boolean]
}>()

const toast = useToast()

// 状态
const repositoryMode = ref<'existing' | 'create'>('create')
const urlError = ref<string | null>(null)
const isRepoNameAutoFilled = ref(false)
const userProvider = ref<'github' | 'gitlab'>('gitlab')
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

// 用户可以选择使用 OAuth 或手动输入 token
// 如果 accessToken 为空，后端会自动从 OAuth 账户获取
// 这样更安全，不需要在前端暴露 token

// 加载用户仓库列表
async function loadUserRepositories() {
  loadingRepos.value = true
  repoError.value = null
  showRepoList.value = false

  try {
    // 使用特殊标记，后端会自动从 OAuth 账户获取 token
    userRepos.value = await trpc.repositories.listUserRepositories.query({
      provider: userProvider.value,
      accessToken: '__USE_OAUTH__', // 后端自动处理
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
    /(?:https?:\/\/|git@)?(github\.com|gitlab\.com)(?::|\/)([^/]+\/[^/\s]+)/i,
  )

  if (!match) {
    urlError.value = '仓库 URL 格式不正确'
    return
  }

  const host = match[1]!.toLowerCase()
  const expectedHost = userProvider.value === 'github' ? 'github.com' : 'gitlab.com'

  if (!host.includes(expectedHost.split('.')[0]!)) {
    urlError.value = `请使用您登录的 ${userProvider.value === 'github' ? 'GitHub' : 'GitLab'} 仓库`
    return
  }

  urlError.value = null
}

// 监听项目名称变化，自动填充仓库名称
watch(
  () => props.projectName,
  (newProjectName) => {
    if (repositoryMode.value === 'create' && newProjectName && !newRepo.value.name) {
      const suggestedName = newProjectName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
      newRepo.value.name = suggestedName
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
  [repositoryMode, existingRepo, newRepo],
  () => {
    let config: any = null

    if (repositoryMode.value === 'existing') {
      if (existingRepo.value.url && !urlError.value) {
        config = {
          mode: 'existing' as const,
          provider: userProvider.value,
          url: existingRepo.value.url,
          accessToken: '__USE_OAUTH__', // 后端自动从 OAuth 获取
          defaultBranch: existingRepo.value.defaultBranch || 'main',
        }
      }
    } else {
      if (newRepo.value.name) {
        config = {
          mode: 'create' as const,
          provider: userProvider.value,
          name: newRepo.value.name,
          visibility: newRepo.value.visibility,
          accessToken: '__USE_OAUTH__', // 后端自动从 OAuth 获取
          defaultBranch: 'main',
          includeAppCode: false,
        }
      }
    }

    emit('update:modelValue', config)
  },
  { deep: true, immediate: true },
)
</script>
