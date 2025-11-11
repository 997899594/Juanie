<template>
  <div class="container mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">设置</h1>
      <p class="text-muted-foreground">管理您的账户设置和偏好</p>
    </div>

    <Tabs default-value="appearance" class="w-full">
      <TabsList class="grid w-full grid-cols-4">
        <TabsTrigger value="appearance">外观</TabsTrigger>
        <TabsTrigger value="notifications">通知</TabsTrigger>
        <TabsTrigger value="display">显示</TabsTrigger>
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
import { LogOut, Monitor, Moon, Sun } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

const router = useRouter()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>
