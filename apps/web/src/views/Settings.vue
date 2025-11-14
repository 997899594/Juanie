<template>
  <div class="container mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">设置</h1>
      <p class="text-muted-foreground">管理您的账户设置和偏好</p>
    </div>

    <Tabs default-value="appearance" class="w-full">
      <TabsList class="grid w-full grid-cols-6">
        <TabsTrigger value="appearance">外观</TabsTrigger>
        <TabsTrigger value="notifications">通知</TabsTrigger>
        <TabsTrigger value="display">显示</TabsTrigger>
        <TabsTrigger value="oauth">OAuth</TabsTrigger>
        <TabsTrigger value="gitops">GitOps</TabsTrigger>
        <TabsTrigger value="account">账户</TabsTrigger>
      </TabsList>

      <!-- 外观设置 -->
      <TabsContent value="appearance" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>主题</CardTitle>
            <CardDescription>选择应用的外观主题</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>主题模式</Label>
              <div class="grid gap-3">
                <Button
                  variant="outline"
                  :class="{ 'border-primary': preferencesStore.themeMode === 'light' }"
                  @click="preferencesStore.setThemeMode('light')"
                  class="justify-start"
                >
                  <Sun class="mr-2 h-4 w-4" />
                  浅色
                </Button>
                <Button
                  variant="outline"
                  :class="{ 'border-primary': preferencesStore.themeMode === 'dark' }"
                  @click="preferencesStore.setThemeMode('dark')"
                  class="justify-start"
                >
                  <Moon class="mr-2 h-4 w-4" />
                  深色
                </Button>
                <Button
                  variant="outline"
                  :class="{ 'border-primary': preferencesStore.themeMode === 'system' }"
                  @click="preferencesStore.setThemeMode('system')"
                  class="justify-start"
                >
                  <Monitor class="mr-2 h-4 w-4" />
                  跟随系统
                </Button>
              </div>
            </div>

            <Separator />

            <div class="space-y-2">
              <Label>主题风格</Label>
              <Select :model-value="preferencesStore.themeId" @update:model-value="(value) => preferencesStore.setThemeStyle(value as 'default' | 'github' | 'bilibili')">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择主题风格" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="bilibili">Bilibili</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div class="space-y-2">
              <Label>语言</Label>
              <Select :model-value="preferencesStore.language" @update:model-value="(value) => preferencesStore.setLanguage(value as 'zh' | 'en')">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">简体中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 通知设置 -->
      <TabsContent value="notifications" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>通知偏好</CardTitle>
            <CardDescription>管理您接收通知的方式</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>启用通知</Label>
                <p class="text-sm text-muted-foreground">接收系统通知和更新</p>
              </div>
              <Switch
                :checked="preferencesStore.notificationsEnabled"
                @update:checked="(value: boolean) => preferencesStore.notificationsEnabled = value"
              />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>声音提示</Label>
                <p class="text-sm text-muted-foreground">通知时播放提示音</p>
              </div>
              <Switch
                :checked="preferencesStore.soundEnabled"
                @update:checked="(value: boolean) => preferencesStore.soundEnabled = value"
                :disabled="!preferencesStore.notificationsEnabled"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 显示设置 -->
      <TabsContent value="display" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>显示偏好</CardTitle>
            <CardDescription>自定义界面显示方式</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>紧凑模式</Label>
                <p class="text-sm text-muted-foreground">减少界面元素间距</p>
              </div>
              <Switch
                :checked="preferencesStore.compactMode"
                @update:checked="(value: boolean) => preferencesStore.compactMode = value"
              />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>动画效果</Label>
                <p class="text-sm text-muted-foreground">启用页面过渡和动画</p>
              </div>
              <Switch
                :checked="preferencesStore.animationsEnabled"
                @update:checked="(value: boolean) => preferencesStore.animationsEnabled = value"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- OAuth 账户管理 -->
      <TabsContent value="oauth" class="space-y-4">
        <OAuthAccountsManager />
      </TabsContent>

      <!-- GitOps 设置 -->
      <TabsContent value="gitops" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Flux 管理</CardTitle>
            <CardDescription>管理 Flux v2 GitOps 工具的安装和配置</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div class="flex gap-3">
                <GitBranch class="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div class="space-y-1">
                  <p class="text-sm font-medium text-blue-900">什么是 Flux？</p>
                  <p class="text-sm text-blue-700">
                    Flux 是一个 GitOps 工具，用于自动化 Kubernetes 集群的配置管理和部署。
                    它会持续监控 Git 仓库的变更，并自动将变更应用到集群中。
                  </p>
                </div>
              </div>
            </div>

            <div v-if="fluxLoading" class="flex items-center justify-center py-8">
              <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
            </div>

            <div v-else-if="fluxHealth" class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label>Flux 状态</Label>
                  <p class="text-sm text-muted-foreground">
                    {{ fluxHealth.overall === 'healthy' ? '运行正常' : '异常' }}
                  </p>
                </div>
                <Badge :variant="fluxHealth.overall === 'healthy' ? 'default' : 'destructive'">
                  {{ fluxHealth.overall === 'healthy' ? '健康' : '异常' }}
                </Badge>
              </div>

              <Separator />

              <div class="space-y-2">
                <Label>组件状态</Label>
                <div class="space-y-2">
                  <div
                    v-for="component in fluxHealth.components"
                    :key="component.name"
                    class="flex items-center justify-between text-sm"
                  >
                    <span>{{ component.name }}</span>
                    <Badge :variant="component.ready ? 'default' : 'destructive'" class="text-xs">
                      {{ component.ready ? '就绪' : '异常' }}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div class="flex gap-2">
                <Button variant="outline" @click="checkFlux" :disabled="fluxLoading">
                  <RefreshCw :class="['h-4 w-4 mr-2', fluxLoading && 'animate-spin']" />
                  刷新状态
                </Button>
                <Button variant="destructive" @click="handleUninstallFlux" :disabled="fluxLoading">
                  <Trash2 class="h-4 w-4 mr-2" />
                  卸载 Flux
                </Button>
              </div>
            </div>

            <div v-else class="space-y-4">
              <p class="text-sm text-muted-foreground">
                Flux 尚未安装。安装 Flux 后，您可以使用 GitOps 功能进行自动化部署。
              </p>
              <Button @click="handleInstallFlux" :disabled="fluxLoading">
                <Download class="h-4 w-4 mr-2" />
                安装 Flux
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 账户设置 -->
      <TabsContent value="account" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
            <CardDescription>管理您的账户信息</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>用户名</Label>
              <Input :value="authStore.user?.username" disabled />
            </div>

            <div class="space-y-2">
              <Label>邮箱</Label>
              <Input :value="authStore.user?.email" disabled />
            </div>

            <div class="space-y-2">
              <Label>显示名称</Label>
              <Input :value="authStore.user?.displayName" disabled />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>账户状态</Label>
                <p class="text-sm text-muted-foreground">活跃</p>
              </div>
              <Badge variant="default">活跃</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>危险操作</CardTitle>
            <CardDescription>这些操作不可逆，请谨慎操作</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" @click="handleLogout">
              <LogOut class="mr-2 h-4 w-4" />
              退出登录
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@juanie/ui'
import { LogOut, Monitor, Moon, Sun, GitBranch, Loader2, RefreshCw, Download, Trash2 } from 'lucide-vue-next'
import OAuthAccountsManager from '@/components/OAuthAccountsManager.vue'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useGitOps } from '@/composables/useGitOps'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const toast = useToast()
const { fluxHealth, installFlux, checkFluxHealth, uninstallFlux } = useGitOps()

const fluxLoading = ref(false)

onMounted(async () => {
  await checkFlux()
})

async function checkFlux() {
  fluxLoading.value = true
  try {
    await checkFluxHealth()
  } catch (error) {
    // Flux 未安装或检查失败
    console.log('Flux not installed or check failed')
  } finally {
    fluxLoading.value = false
  }
}

async function handleInstallFlux() {
  fluxLoading.value = true
  try {
    await installFlux({ namespace: 'flux-system' })
    await checkFlux()
  } catch (error) {
    console.error('Failed to install Flux:', error)
  } finally {
    fluxLoading.value = false
  }
}

async function handleUninstallFlux() {
  if (!confirm('确定要卸载 Flux 吗？这将停止所有 GitOps 自动化部署。')) {
    return
  }

  fluxLoading.value = true
  try {
    await uninstallFlux()
    await checkFlux()
  } catch (error) {
    console.error('Failed to uninstall Flux:', error)
  } finally {
    fluxLoading.value = false
  }
}

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>
