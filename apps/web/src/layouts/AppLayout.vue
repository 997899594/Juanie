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
        <!-- 组织切换器 -->
        <div class="px-2 py-2">
          <OrganizationSwitcher />
        </div>
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
                <SidebarMenuButton as-child :tooltip="'项目管理'">
                <router-link to="/projects" class="flex items-center">
                  <FolderOpen class="size-4" />
                  <span>项目管理</span>
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

        <!-- AI 智能化模块 -->
        <SidebarGroup>
          <SidebarGroupLabel>AI 智能化</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'AI 助手'">
                <router-link to="/ai/assistants" class="flex items-center">
                  <Bot class="size-4" />
                  <span>AI 助手</span>
                  <Badge variant="secondary" class="ml-auto text-xs">Beta</Badge>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'智能推荐'">
                <router-link to="/ai/recommendations" class="flex items-center">
                  <Brain class="size-4" />
                  <span>智能推荐</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'代码分析'">
                <router-link to="/ai/code-analysis" class="flex items-center">
                  <Code class="size-4" />
                  <span>代码分析</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <!-- 安全与合规模块 -->
        <SidebarGroup>
          <SidebarGroupLabel>安全与合规</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'零信任策略'">
                <router-link to="/security/zero-trust" class="flex items-center">
                  <Shield class="size-4" />
                  <span>零信任策略</span>
                  <Badge variant="outline" class="ml-auto text-xs">New</Badge>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'漏洞扫描'">
                <router-link to="/security/vulnerabilities" class="flex items-center">
                  <AlertTriangle class="size-4" />
                  <span>漏洞扫描</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'安全策略'">
                <router-link to="/security/policies" class="flex items-center">
                  <Lock class="size-4" />
                  <span>安全策略</span>
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
              <SidebarMenuButton as-child :tooltip="'性能监控'">
                <router-link to="/monitoring" class="flex items-center">
                  <Activity class="size-4" />
                  <span>性能监控</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'智能告警'">
                <router-link to="/monitoring/alerts" class="flex items-center">
                  <Bell class="size-4" />
                  <span>智能告警</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'通知中心'">
                <router-link to="/notifications" class="flex items-center">
                  <Bell class="size-4" />
                  <span>通知中心</span>
                  <Badge v-if="notificationUnreadCount > 0" variant="destructive" class="ml-auto">
                    {{ notificationUnreadCount }}
                  </Badge>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'事件管理'">
                <router-link to="/monitoring/incidents" class="flex items-center">
                  <AlertCircle class="size-4" />
                  <span>事件管理</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <!-- 成本与可持续性模块 -->
        <SidebarGroup>
          <SidebarGroupLabel>成本与可持续性</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'成本跟踪'">
                <router-link to="/cost/tracking" class="flex items-center">
                  <DollarSign class="size-4" />
                  <span>成本跟踪</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'资源优化'">
                <router-link to="/cost/optimization" class="flex items-center">
                  <TrendingUp class="size-4" />
                  <span>资源优化</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'可持续性指标'">
                <router-link to="/sustainability/metrics" class="flex items-center">
                  <Leaf class="size-4" />
                  <span>可持续性指标</span>
                  <Badge variant="secondary" class="ml-auto text-xs">ESG</Badge>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <!-- 实验与创新模块 -->
        <SidebarGroup>
          <SidebarGroupLabel>实验与创新</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'A/B 测试'">
                <router-link to="/experiments/ab-testing" class="flex items-center">
                  <TestTube class="size-4" />
                  <span>A/B 测试</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :tooltip="'特性开关'">
                <router-link to="/experiments/feature-flags" class="flex items-center">
                  <ToggleLeft class="size-4" />
                  <span>特性开关</span>
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
                    <AvatarImage :src="authStore.user?.avatarUrl || ''" :alt="authStore.user?.displayName || authStore.user?.username || '用户头像'" />
                    <AvatarFallback class="rounded-lg">
                      {{ (authStore.user?.displayName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ authStore.user?.displayName || authStore.user?.username || '用户' }}</span>
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
                      <AvatarImage :src="authStore.user?.avatarUrl || ''" :alt="authStore.user?.displayName || authStore.user?.username || '用户头像'" />
                      <AvatarFallback class="rounded-lg">
                        {{ (authStore.user?.displayName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ authStore.user?.displayName || authStore.user?.username || '用户' }}</span>
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
                    <span>主题模式 ({{ preferencesStore.themeMode === 'system' ? '跟随系统' : preferencesStore.themeMode === 'dark' ? '深色' : '浅色' }})</span>
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
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { generateNavigationConfig } from '@/router'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
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
  AlertCircle,
  AlertTriangle,
  AppWindow,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Building,
  ChevronsUpDown,
  Code,
  DollarSign,
  FileSearch,
  FileText,
  FolderOpen,
  GitBranch,
  Leaf,
  Lock,
  LogOut,
  Moon,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Sun,
  TestTube,
  ToggleLeft,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Webhook,
  Zap,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useNotifications } from '@/composables/useNotifications'
import OrganizationSwitcher from '@/components/OrganizationSwitcher.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const { fetchUnreadCount } = useNotifications()

// 通知未读数量
const notificationUnreadCount = ref(0)

// 使用主题功能
const { isDark, toggleMode } = preferencesStore

// 图标映射
const iconMap: Record<string, any> = {
  AppWindow,
  FolderOpen,
  GitBranch,
  Rocket,
  Bot,
  Brain,
  Code,
  Shield,
  AlertTriangle,
  Lock,
  FileSearch,
  BarChart3,
  Activity,
  Bell,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Server,
  Leaf,
  TestTube,
  ToggleLeft,
  Users,
  UserCheck,
  Building,
  Webhook,
  Zap,
  FileText,
  Settings,
}

// 从路由配置生成导航菜单
const navigationGroups = computed(() => {
  const config = generateNavigationConfig()
  
  // 转换为组件需要的格式
  const groups: Array<{
    title: string
    items: Array<{
      title: string
      href: string
      icon: any
      badge?: string
    }>
  }> = []

  Object.entries(config).forEach(([groupName, items]) => {
    groups.push({
      title: groupName,
      items: items.map(item => ({
        title: item.title,
        href: item.path,
        icon: iconMap[item.icon] || AppWindow,
        badge: item.badge
      }))
    })
  })

  return groups
})

// 页面标题映射 - 从路由元数据获取
const currentPageTitle = computed(() => {
  return route.meta?.title || '应用管理'
})

// 动态生成面包屑
const breadcrumbItems = computed(() => {
  const pathSegments = route.path.split('/').filter(Boolean)
  const breadcrumbs: Array<{ title: string; path: string }> = []
  
  let currentPath = ''
  pathSegments.forEach(segment => {
    currentPath += `/${segment}`
    // 这里可以根据路由配置查找对应的标题
    const matchedRoute = router.getRoutes().find(r => r.path === currentPath)
    if (matchedRoute?.meta?.title) {
      breadcrumbs.push({
        title: matchedRoute.meta.title,
        path: currentPath
      })
    }
  })
  
  return breadcrumbs.slice(0, -1) // 移除最后一个，因为它是当前页面
})

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

// 加载未读通知数量
async function loadUnreadCount() {
  try {
    notificationUnreadCount.value = await fetchUnreadCount()
  } catch (error) {
    console.error('Failed to fetch unread count:', error)
  }
}

// 定期刷新未读数量（每30秒）
let unreadCountInterval: number | undefined

onMounted(() => {
  loadUnreadCount()
  unreadCountInterval = window.setInterval(loadUnreadCount, 30000)
})

// 清理定时器
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (unreadCountInterval) {
    clearInterval(unreadCountInterval)
  }
})
</script>