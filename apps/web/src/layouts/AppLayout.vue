<template>
  <SidebarProvider>
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <router-link to="/" class="flex items-center">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <AppWindow class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">Juanie</span>
                  <span class="truncate text-xs">DevOps Platform</span>
                </div>
              </router-link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>应用管理</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'应用列表'">
                <router-link to="/" class="flex items-center">
                  <AppWindow class="size-4" />
                  <span>应用列表</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'流水线'">
                <router-link to="/pipelines" class="flex items-center">
                  <GitBranch class="size-4" />
                  <span>流水线</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'部署记录'">
                <router-link to="/deployments" class="flex items-center">
                  <Rocket class="size-4" />
                  <span>部署记录</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>监控与分析</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'仪表盘'">
                <router-link to="/dashboard" class="flex items-center">
                  <BarChart3 class="size-4" />
                  <span>仪表盘</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'监控'">
                <router-link to="/monitoring" class="flex items-center">
                  <Activity class="size-4" />
                  <span>监控</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>文档与设置</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'文档'">
                <router-link to="/documents" class="flex items-center">
                  <FileText class="size-4" />
                  <span>文档</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'设置'">
                <router-link to="/settings" class="flex items-center">
                  <Settings class="size-4" />
                  <span>设置</span>
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
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton
                  size="lg"
                  class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar class="h-8 w-8 rounded-lg">
                    <AvatarImage :src="authStore.user?.image || ''" :alt="authStore.user?.name" />
                    <AvatarFallback class="rounded-lg">
                      {{ authStore.user?.name?.charAt(0) || 'U' }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ authStore.user?.name || '用户' }}</span>
                    <span class="truncate text-xs">{{ authStore.user?.email || '' }}</span>
                  </div>
                  <ChevronsUpDown class="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                :side-offset="4"
              >
                <DropdownMenuLabel class="p-0 font-normal">
                  <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar class="h-8 w-8 rounded-lg">
                      <AvatarImage :src="authStore.user?.image || ''" :alt="authStore.user?.name" />
                      <AvatarFallback class="rounded-lg">
                        {{ authStore.user?.name?.charAt(0) || 'U' }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ authStore.user?.name || '用户' }}</span>
                      <span class="truncate text-xs">{{ authStore.user?.email || '' }}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Sparkles />
                    升级到企业版
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User />
                    个人资料
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings />
                    账户设置
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="toggleMode">
                    <Moon v-if="!isDark" class="h-4 w-4" />
                    <Sun v-else class="h-4 w-4" />
                    <span>切换主题</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click="handleLogout">
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset>
      <!-- Fixed Header -->
      <header class="fixed top-4 right-4 z-50 flex h-8 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl">
        <div class="flex items-center px-4" :class="breadcrumbItems.length > 0 ? 'gap-2' : ''">
          <SidebarTrigger class="-ml-1" />
          <!-- 只有当存在面包屑路径时才显示分隔符和面包屑 -->
          <template v-if="breadcrumbItems.length > 0">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink @click="router.push('/')" class="cursor-pointer">
                    Juanie
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <template v-for="(item, index) in breadcrumbItems" :key="item.path">
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      v-if="index < breadcrumbItems.length - 1"
                      @click="router.push(item.path)" 
                      class="cursor-pointer"
                    >
                      {{ item.title }}
                    </BreadcrumbLink>
                    <BreadcrumbPage v-else>
                      {{ item.title }}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator v-if="index < breadcrumbItems.length - 1" />
                </template>
              </BreadcrumbList>
            </Breadcrumb>
          </template>
        </div>
      </header>
      
      <div class="flex flex-1 flex-col gap-4 p-4 pt-20">
          <router-view />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
} from '@juanie/ui'
import {
  Activity,
  AppWindow,
  BarChart3,
  FileText,
  GitBranch,
  LogOut,
  Moon,
  Rocket,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-vue-next'
import { useTheme } from '@juanie/ui'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 使用主题功能
const { isDark, toggleMode } = useTheme()

// 页面标题映射
const pageTitleMap: Record<string, string> = {
  'apps': '应用列表',
  'dashboard': '仪表盘',
  'documents': '文档',
  'pipelines': '流水线',
  'deployments': '部署记录',
  'monitoring': '监控',
  'settings': '设置',
  'demo': '组件演示',
}

// 面包屑路径映射
const breadcrumbPathMap: Record<string, { title: string; path: string }[]> = {
  'apps': [],
  'dashboard': [{ title: '仪表盘', path: '/dashboard' }],
  'documents': [{ title: '文档', path: '/documents' }],
  'pipelines': [{ title: '流水线', path: '/pipelines' }],
  'deployments': [{ title: '部署记录', path: '/deployments' }],
  'monitoring': [{ title: '监控', path: '/monitoring' }],
  'settings': [{ title: '设置', path: '/settings' }],
  'demo': [{ title: '组件演示', path: '/demo' }],
}

const currentPageTitle = computed(() => {
  return pageTitleMap[route.name as string] || '应用列表'
})

// 动态生成面包屑
const breadcrumbItems = computed(() => {
  const routeName = route.name as string
  return breadcrumbPathMap[routeName] || []
})

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>