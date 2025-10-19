<template>
  <SidebarProvider>
    <div class="min-h-screen flex w-full bg-background">
      <!-- 侧边栏 -->
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="#">
                  <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <AppWindow class="size-4" />
                  </div>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">DevOps Platform</span>
                    <span class="truncate text-xs">企业级 DevOps 平台</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>应用管理</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem v-for="item in navItems" :key="item.name">
                <SidebarMenuButton :tooltip="item.name" asChild>
                  <router-link :to="item.path" class="flex items-center gap-2">
                    <component :is="item.icon" class="size-4" />
                    <span>{{ item.name }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar class="h-8 w-8 rounded-lg">
                      <AvatarImage :src="user?.image || ''" :alt="user?.name || ''" />
                      <AvatarFallback class="rounded-lg">
                        {{ user?.name?.charAt(0) || 'U' }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ user?.name || '用户名' }}</span>
                      <span class="truncate text-xs">{{ user?.email || 'user@example.com' }}</span>
                    </div>
                    <ChevronsUpDown class="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  :sideOffset="4"
                >
                  <DropdownMenuLabel class="p-0 font-normal">
                    <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar class="h-8 w-8 rounded-lg">
                        <AvatarImage :src="user?.image || ''" :alt="user?.name || ''" />
                        <AvatarFallback class="rounded-lg">
                          {{ user?.name?.charAt(0) || 'U' }}
                        </AvatarFallback>
                      </Avatar>
                      <div class="grid flex-1 text-left text-sm leading-tight">
                        <span class="truncate font-semibold">{{ user?.name || '用户名' }}</span>
                        <span class="truncate text-xs">{{ user?.email || 'user@example.com' }}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Sparkles class="mr-2 h-4 w-4" />
                      <span>升级到专业版</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <BadgeCheck class="mr-2 h-4 w-4" />
                      <span>账户设置</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <CreditCard class="mr-2 h-4 w-4" />
                      <span>账单管理</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Bell class="mr-2 h-4 w-4" />
                      <span>通知设置</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem @click="toggleTheme">
                      <component :is="isCurrentThemeDark ? Sun : Moon" class="mr-2 h-4 w-4" />
                      <span>{{ isCurrentThemeDark ? '浅色模式' : '深色模式' }}</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="logout">
                    <LogOut class="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
      <!-- 主内容区域 -->
      <SidebarInset>
        <!-- 顶部导航栏 -->
        <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div class="flex items-center gap-2 px-4">
            <SidebarTrigger class="-ml-1" />
            <Separator orientation="vertical" class="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem class="hidden md:block">
                  <BreadcrumbLink href="#">
                    DevOps Platform
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator class="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{{ currentPageTitle }}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        
        <!-- 页面内容 -->
        <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <router-view />
        </div>
      </SidebarInset>
    </div>
  </SidebarProvider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useTheme
} from '@juanie/ui'
import {
  AppWindow,
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  FileText,
  LogOut,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { toggleMode, isCurrentThemeDark } = useTheme()

// 导航菜单项
const navItems = [
  {
    name: '我的应用',
    path: '/',
    icon: AppWindow,
  },
  {
    name: '文档管理',
    path: '/documents',
    icon: FileText,
  },
]

// 模拟用户数据
const user = ref<{
  name: string
  email: string
  image: string
} | null>({
  name: 'Juanie User',
  email: '997899594@qq.com',
  image: 'https://github.com/shadcn.png',
})

// 当前页面标题
const currentPageTitle = computed(() => {
  const currentItem = navItems.find(item => item.path === route.path)
  return currentItem?.name || '我的应用'
})

// 切换主题
const toggleTheme = () => {
  toggleMode()
}

// 退出登录
const logout = async () => {
  try {
    // TODO: 调用登出 API
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    
    // 清除本地状态
    user.value = null
    
    // 跳转到登录页
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

// 生命周期
onMounted(async () => {
  try {
    // TODO: 从 API 获取用户信息
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    })
    
    if (response.ok) {
      const userData = await response.json()
      user.value = userData
    }
  } catch (error) {
    console.error('Failed to fetch user info:', error)
  }
})
</script>