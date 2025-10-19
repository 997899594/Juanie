<template>
  <div class="min-h-screen bg-background">
    <!-- 侧边栏 -->
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <div class="flex items-center gap-2 px-2 py-1">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span class="text-sm font-bold">J</span>
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">Juanie</span>
              <span class="truncate text-xs text-muted-foreground">DevOps Platform</span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>平台功能</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton as-child>
                    <router-link to="/apps" class="flex items-center gap-2">
                      <AppWindow class="h-4 w-4" />
                      <span>我的应用</span>
                    </router-link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton as-child>
                    <router-link to="/pipelines" class="flex items-center gap-2">
                      <GitBranch class="h-4 w-4" />
                      <span>流水线</span>
                    </router-link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton as-child>
                    <router-link to="/deployments" class="flex items-center gap-2">
                      <Rocket class="h-4 w-4" />
                      <span>部署管理</span>
                    </router-link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton as-child>
                    <router-link to="/monitoring" class="flex items-center gap-2">
                      <Activity class="h-4 w-4" />
                      <span>监控中心</span>
                    </router-link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>工具与设置</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton as-child>
                    <router-link to="/documents" class="flex items-center gap-2">
                      <FileText class="h-4 w-4" />
                      <span>文档管理</span>
                    </router-link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton as-child>
                    <router-link to="/settings" class="flex items-center gap-2">
                      <Settings class="h-4 w-4" />
                      <span>系统设置</span>
                    </router-link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
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
                      <AvatarImage 
                        v-if="authStore.user?.image" 
                        :src="authStore.user.image" 
                        :alt="authStore.user?.name || 'User'" 
                      />
                      <AvatarFallback class="rounded-lg">
                        {{ authStore.user?.name?.charAt(0)?.toUpperCase() || 'U' }}
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
                        <AvatarImage 
                          v-if="authStore.user?.image" 
                          :src="authStore.user.image" 
                          :alt="authStore.user?.name || 'User'" 
                        />
                        <AvatarFallback class="rounded-lg">
                          {{ authStore.user?.name?.charAt(0)?.toUpperCase() || 'U' }}
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
                    <DropdownMenuItem @click="$router.push('/profile')">
                      <User />
                      个人资料
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="$router.push('/settings')">
                      <Settings />
                      设置
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem @click="toggleTheme">
                      <Palette />
                      切换主题
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="handleLogout" :disabled="authStore.loading">
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
        <!-- 顶部导航栏 -->
        <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div class="flex items-center gap-2 px-4">
            <SidebarTrigger class="-ml-1" />
            <Separator orientation="vertical" class="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem class="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    Juanie
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
        
        <!-- 主内容区域 -->
        <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <slot />
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@juanie/ui'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@juanie/ui'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@juanie/ui'
import { Separator } from '@juanie/ui'
import {
  Activity,
  AppWindow,
  ChevronsUpDown,
  FileText,
  GitBranch,
  LogOut,
  Palette,
  Rocket,
  Settings,
  User,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 当前页面标题
const currentPageTitle = computed(() => {
  return route.meta?.title as string || '首页'
})

// 退出登录
const handleLogout = async () => {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

// 主题切换 (简单实现，后续可以扩展)
const toggleTheme = () => {
  const html = document.documentElement
  const isDark = html.classList.contains('dark')
  
  if (isDark) {
    html.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  } else {
    html.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  }
}
</script>