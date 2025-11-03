<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300, ease: 'easeOut' } }"
    class="min-h-screen bg-background text-foreground p-8"
  >
    <div class="max-w-6xl mx-auto space-y-8">
      <!-- 页面标题 -->
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.9 }"
        :enter="{ opacity: 1, scale: 1, transition: { duration: 300, delay: 100 } }"
        class="text-center"
      >
        <h1 class="text-4xl font-bold mb-2">Juanie UI 组件测试</h1>
        <p class="text-muted-foreground">测试 shadcn-vue 组件和主题功能</p>
        <div class="mt-4">
          <Button as="a" href="/demo" variant="outline">
            查看完整组件库演示 →
          </Button>
        </div>
      </div>

      <!-- 主题切换器 -->
      <Card>
        <CardHeader>
          <CardTitle>主题切换</CardTitle>
          <CardDescription>切换不同的主题和暗色模式</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-3 mb-4">
            <Button 
              v-for="themeOption in themes"
              :key="themeOption.id"
              :variant="currentTheme?.id === themeOption.id ? 'default' : 'outline'"
              size="sm"
              @click="setTheme(themeOption.id)"
            >
              {{ themeOption.name }}
            </Button>
          </div>
          <Button 
            :variant="isDark ? 'default' : 'outline'"
            @click="toggleMode()"
          >
            {{ isDark ? '🌙 暗色模式' : '☀️ 亮色模式' }}
          </Button>
        </CardContent>
      </Card>

      <!-- 按钮组件测试 -->
      <Card>
        <CardHeader>
          <CardTitle>Button 组件</CardTitle>
          <CardDescription>不同的按钮变体和尺寸</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div class="flex flex-wrap gap-3 items-center">
            <Button size="sm">Small</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">🚀</Button>
          </div>
        </CardContent>
      </Card>

      <!-- 输入框组件测试 -->
      <Card>
        <CardHeader>
          <CardTitle>Input 组件</CardTitle>
          <CardDescription>表单输入元素</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <Input placeholder="请输入您的姓名..." />
          <Input type="email" placeholder="请输入您的邮箱..." />
          <Input type="password" placeholder="请输入您的密码..." />
          <Input disabled placeholder="禁用状态的输入框" />
        </CardContent>
      </Card>

      <!-- 卡片组合测试 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>功能卡片 1</CardTitle>
            <CardDescription>这是一个示例卡片</CardDescription>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground mb-4">
              这里是卡片的内容区域，可以放置任何内容。
            </p>
            <Button class="w-full">操作按钮</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>功能卡片 2</CardTitle>
            <CardDescription>带有表单的卡片</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <Input placeholder="用户名" />
            <Input type="password" placeholder="密码" />
            <Button class="w-full">登录</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>功能卡片 3</CardTitle>
            <CardDescription>多按钮操作</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <p class="text-sm text-muted-foreground">
              选择您要执行的操作：
            </p>
            <div class="flex gap-2">
              <Button variant="outline" size="sm">取消</Button>
              <Button size="sm">确认</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 颜色系统展示 -->
      <Card>
        <CardHeader>
          <CardTitle>OKLCH 颜色系统</CardTitle>
          <CardDescription>当前主题的颜色变量展示</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="space-y-2">
              <div class="w-full h-12 bg-primary rounded border"></div>
              <p class="text-xs text-center">Primary</p>
            </div>
            <div class="space-y-2">
              <div class="w-full h-12 bg-secondary rounded border"></div>
              <p class="text-xs text-center">Secondary</p>
            </div>
            <div class="space-y-2">
              <div class="w-full h-12 bg-accent rounded border"></div>
              <p class="text-xs text-center">Accent</p>
            </div>
            <div class="space-y-2">
              <div class="w-full h-12 bg-muted rounded border"></div>
              <p class="text-xs text-center">Muted</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Button, 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  Input,
  useTheme 
} from '@juanie/ui'

const { currentTheme, setTheme, toggleMode, themes, isDark } = useTheme()
  const availableThemes = themes
</script>
