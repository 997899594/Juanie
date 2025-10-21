<template>
  <div class="container mx-auto p-6 max-w-4xl">
    <div class="space-y-6">
      <!-- 页面标题 -->
      <div>
        <h1 class="text-3xl font-bold tracking-tight">设置</h1>
        <p class="text-muted-foreground">
          管理您的账户设置和应用偏好
        </p>
      </div>

      <!-- 设置卡片 -->
      <div class="grid gap-6">
        <!-- 主题设置 -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Palette class="h-5 w-5" />
              主题设置
            </CardTitle>
            <CardDescription>
              选择您喜欢的主题和外观模式
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- 主题选择 -->
            <div class="space-y-3">
              <Label class="text-sm font-medium">选择主题</Label>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  v-for="theme in themes"
                  :key="theme.id"
                  class="relative"
                >
                  <input
                    :id="`theme-${theme.id}`"
                    v-model="themeId"
                    :value="theme.id"
                    type="radio"
                    class="peer sr-only"
                    @change="setTheme(theme.id)"
                  />
                  <label
                    :for="`theme-${theme.id}`"
                    class="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex items-center gap-2">
                        <div 
                          class="w-3 h-3 rounded-full"
                          :style="{ backgroundColor: getThemeColor('primary') }"
                        ></div>
                      </div>
                      <span class="font-medium">{{ theme.name }}</span>
                    </div>
                    <Check v-if="themeId === theme.id" class="h-4 w-4" />
                  </label>
                </div>
              </div>
            </div>

            <!-- 明暗模式切换 -->
            <div class="space-y-3">
              <Label class="text-sm font-medium">外观模式{{ isDark }}</Label>
              <div class="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  :class="{ 'bg-accent': !isDark }"
                  @click="setLightMode"
                >
                  <Sun class="h-4 w-4 mr-2" />
                  浅色模式
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :class="{ 'bg-accent': isDark }"
                  @click="setDarkMode"
                >
                  <Moon class="h-4 w-4 mr-2" />
                  深色模式
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  @click="toggleMode"
                >
                  <Monitor class="h-4 w-4 mr-2" />
                  切换模式
                </Button>
              </div>
            </div>

            <!-- 当前主题信息 -->
            <div class="rounded-lg bg-muted p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">当前主题</p>
                  <p class="text-sm text-muted-foreground">
                    {{ currentTheme?.name }} - {{ isDark ? '深色模式' : '浅色模式' }}
                  </p>
                </div>
                <div class="flex gap-1">
                  <div class="w-4 h-4 rounded-full bg-primary"></div>
                  <div class="w-4 h-4 rounded-full bg-secondary"></div>
                  <div class="w-4 h-4 rounded-full bg-accent"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 其他设置 -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Settings class="h-5 w-5" />
              通用设置
            </CardTitle>
            <CardDescription>
              配置应用的通用选项
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="text-base">自动保存</Label>
                <div class="text-sm text-muted-foreground">
                  自动保存您的工作进度
                </div>
              </div>
              <Switch />
            </div>
            <Separator />
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="text-base">桌面通知</Label>
                <div class="text-sm text-muted-foreground">
                  接收重要事件的桌面通知
                </div>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTheme } from '@juanie/ui'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Separator,
  Switch,
} from '@juanie/ui'
import {
  Check,
  Moon,
  Monitor,
  Palette,
  Settings,
  Sun,
} from 'lucide-vue-next'

// 使用主题功能
const {
  themes,
  currentTheme,
  isDark,
  mode,
  themeId,
  setTheme,
  setMode,
  toggleMode,
} = useTheme()

// 主题组选择已移除，直接使用主题选择

// 简化的主题切换逻辑
const setLightMode = () => setMode('light')
const setDarkMode = () => setMode('dark')

// 本地颜色获取函数（简化版）
const getThemeColor = (colorName: string) => {
  return `hsl(var(--${colorName}))`
}
</script>