<template>
  <div class="min-h-screen bg-background">
    <!-- 页面标题 -->
    <div class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold tracking-tight">Juanie UI 组件库</h1>
            <p class="text-muted-foreground mt-2">完整的 Vue 3 + Tailwind CSS 组件展示</p>
          </div>
          <div class="flex items-center gap-4">
            <Button @click="toggleTheme" variant="outline" size="icon">
              <Sun v-if="isCurrentThemeDark" class="h-4 w-4" />
              <Moon v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-8">
      <div class="grid gap-8">
        <!-- 主题切换器 -->
        <Card>
          <CardHeader>
            <CardTitle>主题系统</CardTitle>
            <CardDescription>支持多种预设主题和深色模式</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-2">
              <Button 
                v-for="theme in availableThemes" 
                :key="theme.name"
                @click="handleThemeSwitch(theme.name)"
                :variant="currentTheme === theme.name ? 'default' : 'outline'"
                size="sm"
                class="theme-switch-button"
                :class="{ 'theme-switching': isThemeSwitching }"
              >
                {{ theme.displayName }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- 按钮组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Button 按钮</CardTitle>
            <CardDescription>支持多种变体和尺寸的按钮组件</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- 按钮变体 -->
            <div>
              <h4 class="text-sm font-medium mb-3">变体 (Variants)</h4>
              <div class="flex flex-wrap gap-2">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>

            <!-- 按钮尺寸 -->
            <div>
              <h4 class="text-sm font-medium mb-3">尺寸 (Sizes)</h4>
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">
                  <Plus class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <!-- 禁用状态 -->
            <div>
              <h4 class="text-sm font-medium mb-3">状态 (States)</h4>
              <div class="flex flex-wrap gap-2">
                <Button>Normal</Button>
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled Outline</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 输入框组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Input 输入框</CardTitle>
            <CardDescription>各种类型的输入框组件</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">普通输入框</label>
                <Input v-model="inputValue" placeholder="请输入内容..." />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">密码输入框</label>
                <Input type="password" placeholder="请输入密码..." />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">邮箱输入框</label>
                <Input type="email" placeholder="请输入邮箱..." />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">禁用状态</label>
                <Input disabled placeholder="禁用的输入框" />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 卡片组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Card 卡片</CardTitle>
            <CardDescription>灵活的卡片容器组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- 基础卡片 -->
              <Card>
                <CardHeader>
                  <CardTitle>基础卡片</CardTitle>
                  <CardDescription>这是一个基础的卡片示例</CardDescription>
                </CardHeader>
                <CardContent>
                  <p class="text-sm text-muted-foreground">
                    卡片内容区域，可以放置任何内容。
                  </p>
                </CardContent>
              </Card>

              <!-- 带操作的卡片 -->
              <Card>
                <CardHeader>
                  <CardTitle>带操作卡片</CardTitle>
                  <CardDescription>包含操作按钮的卡片</CardDescription>
                </CardHeader>
                <CardContent>
                  <p class="text-sm text-muted-foreground mb-4">
                    这个卡片包含了底部的操作按钮。
                  </p>
                </CardContent>
                <CardFooter class="flex justify-between">
                  <Button variant="outline">取消</Button>
                  <Button>确认</Button>
                </CardFooter>
              </Card>

              <!-- 带头像的卡片 -->
              <Card>
                <CardHeader class="flex flex-row items-center space-y-0 pb-2">
                  <Avatar class="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" alt="Avatar" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div class="ml-3">
                    <CardTitle class="text-sm">用户卡片</CardTitle>
                    <CardDescription class="text-xs">@username</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p class="text-sm text-muted-foreground">
                    包含用户头像的卡片示例。
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <!-- 头像组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Avatar 头像</CardTitle>
            <CardDescription>用户头像组件，支持图片和文字回退</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center space-x-4">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarImage src="https://github.com/vercel.png" alt="@vercel" />
                <AvatarFallback>VC</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JU</AvatarFallback>
              </Avatar>
            </div>
          </CardContent>
        </Card>

        <!-- 徽章组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Badge 徽章</CardTitle>
            <CardDescription>用于显示状态或标签的小型组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>

        <!-- 复选框组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Checkbox 复选框</CardTitle>
            <CardDescription>用于多选的复选框组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <div class="flex items-center space-x-2">
                <Checkbox id="terms1" v-model:checked="checkboxValues.terms1" />
                <label for="terms1" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  接受条款和条件
                </label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="terms2" v-model:checked="checkboxValues.terms2" />
                <label for="terms2" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  订阅邮件通知
                </label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="terms3" disabled />
                <label for="terms3" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  禁用的选项
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 开关组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Switch 开关</CardTitle>
            <CardDescription>用于开启/关闭状态的开关组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div class="flex items-center space-x-2">
                <Switch id="airplane-mode" v-model:checked="switchValues.airplaneMode" />
                <label for="airplane-mode" class="text-sm font-medium">飞行模式</label>
              </div>
              <div class="flex items-center space-x-2">
                <Switch id="notifications" v-model:checked="switchValues.notifications" />
                <label for="notifications" class="text-sm font-medium">推送通知</label>
              </div>
              <div class="flex items-center space-x-2">
                <Switch id="disabled-switch" disabled />
                <label for="disabled-switch" class="text-sm font-medium">禁用的开关</label>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 选项卡组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Tabs 选项卡</CardTitle>
            <CardDescription>用于内容分组的选项卡组件</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs default-value="account" class="w-full">
              <TabsList class="grid w-full grid-cols-3">
                <TabsTrigger value="account">账户</TabsTrigger>
                <TabsTrigger value="password">密码</TabsTrigger>
                <TabsTrigger value="settings">设置</TabsTrigger>
              </TabsList>
              <TabsContent value="account" class="space-y-4">
                <div class="space-y-2">
                  <label class="text-sm font-medium">用户名</label>
                  <Input placeholder="请输入用户名" />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium">邮箱</label>
                  <Input type="email" placeholder="请输入邮箱" />
                </div>
              </TabsContent>
              <TabsContent value="password" class="space-y-4">
                <div class="space-y-2">
                  <label class="text-sm font-medium">当前密码</label>
                  <Input type="password" placeholder="请输入当前密码" />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium">新密码</label>
                  <Input type="password" placeholder="请输入新密码" />
                </div>
              </TabsContent>
              <TabsContent value="settings" class="space-y-4">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">邮件通知</label>
                  <Switch />
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">短信通知</label>
                  <Switch />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <!-- 对话框组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Dialog 对话框</CardTitle>
            <CardDescription>模态对话框组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex gap-2">
              <Dialog>
                <DialogTrigger as-child>
                  <Button variant="outline">打开对话框</Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>编辑资料</DialogTitle>
                    <DialogDescription>
                      在这里修改您的个人资料信息。完成后点击保存。
                    </DialogDescription>
                  </DialogHeader>
                  <div class="grid gap-4 py-4">
                    <div class="grid grid-cols-4 items-center gap-4">
                      <label for="name" class="text-right text-sm font-medium">
                        姓名
                      </label>
                      <Input id="name" value="张三" class="col-span-3" />
                    </div>
                    <div class="grid grid-cols-4 items-center gap-4">
                      <label for="username" class="text-right text-sm font-medium">
                        用户名
                      </label>
                      <Input id="username" value="@zhangsan" class="col-span-3" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">保存更改</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <!-- 选择器组件 -->
        <Card>
          <CardHeader>
            <CardTitle>Select 选择器</CardTitle>
            <CardDescription>下拉选择组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">选择框架</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择一个框架" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>前端框架</SelectLabel>
                      <SelectItem value="vue">Vue.js</SelectItem>
                      <SelectItem value="react">React</SelectItem>
                      <SelectItem value="angular">Angular</SelectItem>
                      <SelectItem value="svelte">Svelte</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">选择主题</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择主题" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">浅色主题</SelectItem>
                    <SelectItem value="dark">深色主题</SelectItem>
                    <SelectItem value="system">跟随系统</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Sun, Moon, Plus } from 'lucide-vue-next'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Checkbox,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  useTheme
} from '@juanie/ui'

// 使用主题系统
const { 
  currentTheme, 
  availableThemes, 
  isCurrentThemeDark, 
  setTheme, 
  toggleMode 
} = useTheme()

// 响应式数据
const inputValue = ref('')
const checkboxValues = ref({
  terms1: false,
  terms2: true
})
const switchValues = ref({
  airplaneMode: false,
  notifications: true
})

// 主题切换状态
const isThemeSwitching = ref(false)

// 主题切换处理函数
const handleThemeSwitch = async (themeName: string) => {
  if (currentTheme.value === themeName) return
  
  // 标记正在切换主题
  isThemeSwitching.value = true
  
  // 切换主题
  setTheme(themeName)
  
  // 短暂延迟后恢复动画
  setTimeout(() => {
    isThemeSwitching.value = false
  }, 100)
}

// 主题切换
const toggleTheme = () => {
  toggleMode()
}
</script>