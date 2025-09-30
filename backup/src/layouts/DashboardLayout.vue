<template>
  <div class="dashboard-layout">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo" @click="toggleSidebar">
          <div class="logo-icon">
            <Server class="w-6 h-6" />
          </div>
          <transition name="fade">
            <span v-show="!sidebarCollapsed" class="logo-text">DevOps</span>
          </transition>
        </div>
        
        <button 
          class="sidebar-toggle"
          @click="toggleSidebar"
          :class="{ 'rotated': sidebarCollapsed }"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div v-show="!sidebarCollapsed" class="nav-title">主要功能</div>
          
          <router-link
            v-for="item in mainNavItems"
            :key="item.name"
            :to="item.path"
            class="nav-item"
            :class="{ 'nav-item-active': $route.path === item.path }"
          >
            <component :is="item.icon" class="nav-icon" />
            <transition name="fade">
              <span v-show="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
            </transition>
            <div v-show="!sidebarCollapsed && item.badge" class="nav-badge">{{ item.badge }}</div>
          </router-link>
        </div>
        
        <div class="nav-section">
          <div v-show="!sidebarCollapsed" class="nav-title">管理</div>
          
          <router-link
            v-for="item in managementNavItems"
            :key="item.name"
            :to="item.path"
            class="nav-item"
            :class="{ 'nav-item-active': $route.path === item.path }"
          >
            <component :is="item.icon" class="nav-icon" />
            <transition name="fade">
              <span v-show="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
            </transition>
          </router-link>
        </div>
      </nav>
      
      <div class="sidebar-footer">
        <div class="user-info" @click="showUserMenu = !showUserMenu">
          <div class="user-avatar">
            <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" :alt="authStore.user.username" />
            <User v-else class="w-5 h-5" />
          </div>
          <transition name="fade">
            <div v-show="!sidebarCollapsed" class="user-details">
              <div class="user-name">{{ authStore.user?.fullName || authStore.user?.username }}</div>
              <div class="user-role">{{ getRoleLabel(authStore.user?.role) }}</div>
            </div>
          </transition>
          <transition name="fade">
            <ChevronUp v-show="!sidebarCollapsed" class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showUserMenu }" />
          </transition>
        </div>
        
        <!-- User Menu -->
        <transition name="slide-up">
          <div v-show="showUserMenu && !sidebarCollapsed" class="user-menu">
            <router-link to="/profile" class="user-menu-item">
              <Settings class="w-4 h-4" />
              <span>个人设置</span>
            </router-link>
            <button @click="handleLogout" class="user-menu-item">
              <LogOut class="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </div>
        </transition>
      </div>
    </aside>
    
    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="main-header">
        <div class="header-left">
          <h1 class="page-title">{{ currentPageTitle }}</h1>
          <div class="breadcrumb">
            <span v-for="(crumb, index) in breadcrumbs" :key="index" class="breadcrumb-item">
              {{ crumb }}
              <ChevronRight v-if="index < breadcrumbs.length - 1" class="w-4 h-4" />
            </span>
          </div>
        </div>
        
        <div class="header-right">
          <!-- Search -->
          <div class="search-box">
            <Search class="w-4 h-4 search-icon" />
            <input 
              type="text" 
              placeholder="搜索项目、流水线..." 
              class="search-input"
              v-model="searchQuery"
            />
          </div>
          
          <!-- Notifications -->
          <button class="header-btn" @click="showNotifications = !showNotifications">
            <Bell class="w-5 h-5" />
            <span v-if="notificationCount > 0" class="notification-badge">{{ notificationCount }}</span>
          </button>
          
          <!-- Theme Toggle -->
          <button class="header-btn" @click="toggleTheme">
            <Moon v-if="isDarkMode" class="w-5 h-5" />
            <Sun v-else class="w-5 h-5" />
          </button>
        </div>
      </header>
      
      <!-- Page Content -->
      <div class="page-content">
        <router-view />
      </div>
    </main>
    
    <!-- Notification Panel -->
    <transition name="slide-left">
      <div v-show="showNotifications" class="notification-panel">
        <div class="notification-header">
          <h3>通知</h3>
          <button @click="showNotifications = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="notification-list">
          <div v-for="notification in notifications" :key="notification.id" class="notification-item">
            <div class="notification-icon" :class="notification.type">
              <component :is="getNotificationIcon(notification.type)" class="w-4 h-4" />
            </div>
            <div class="notification-content">
              <div class="notification-title">{{ notification.title }}</div>
              <div class="notification-message">{{ notification.message }}</div>
              <div class="notification-time">{{ formatTime(notification.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    
    <!-- Overlay -->
    <div 
      v-show="showNotifications || showUserMenu" 
      class="overlay" 
      @click="closeAllPanels"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  Server, ChevronLeft, ChevronRight, ChevronUp, User, Settings, LogOut,
  Search, Bell, Moon, Sun, X,
  LayoutDashboard, FolderOpen, GitBranch, Rocket, Shield, Activity,
  AlertTriangle, CheckCircle, Info, AlertCircle, Users
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Sidebar state
const sidebarCollapsed = ref(false)
const showUserMenu = ref(false)
const showNotifications = ref(false)
const searchQuery = ref('')
const isDarkMode = ref(true)
const notificationCount = ref(3)

// Navigation items
const mainNavItems = [
  { name: 'dashboard', path: '/dashboard', label: '仪表板', icon: LayoutDashboard },
  { name: 'projects', path: '/projects', label: '项目管理', icon: FolderOpen, badge: '5' },
  { name: 'pipelines', path: '/pipelines', label: 'CI/CD流水线', icon: GitBranch },
  { name: 'deployments', path: '/deployments', label: '部署管理', icon: Rocket },
  { name: 'code-quality', path: '/code-quality', label: '代码质量', icon: Shield },
  { name: 'monitoring', path: '/monitoring', label: '监控告警', icon: Activity },
]

const managementNavItems = [
  { name: 'users', path: '/users', label: '用户管理', icon: Users },
  { name: 'settings', path: '/settings', label: '系统设置', icon: Settings },
]

// Mock notifications
const notifications = ref([
  {
    id: 1,
    type: 'success',
    title: '部署成功',
    message: '项目 "DevOps Platform" 已成功部署到生产环境',
    createdAt: new Date(Date.now() - 5 * 60 * 1000)
  },
  {
    id: 2,
    type: 'warning',
    title: '代码质量警告',
    message: '项目 "API Gateway" 代码覆盖率低于80%',
    createdAt: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    id: 3,
    type: 'error',
    title: '构建失败',
    message: '项目 "Frontend App" 构建失败，请检查代码',
    createdAt: new Date(Date.now() - 30 * 60 * 1000)
  }
])

// Computed properties
const currentPageTitle = computed(() => {
  return route.meta?.title as string || '仪表板'
})

const breadcrumbs = computed(() => {
  const crumbs = ['DevOps Platform']
  if (route.meta?.title) {
    crumbs.push(route.meta.title as string)
  }
  return crumbs
})

// Methods
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  // Theme switching logic would go here
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const closeAllPanels = () => {
  showUserMenu.value = false
  showNotifications.value = false
}

const getRoleLabel = (role?: string) => {
  const roleLabels = {
    'ADMIN': '管理员',
    'DEVOPS': 'DevOps工程师',
    'DEVELOPER': '开发者'
  }
  return roleLabels[role as keyof typeof roleLabels] || '用户'
}

const getNotificationIcon = (type: string) => {
  const icons = {
    'success': CheckCircle,
    'warning': AlertTriangle,
    'error': AlertCircle,
    'info': Info
  }
  return icons[type as keyof typeof icons] || Info
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

onMounted(() => {
  // Initialize any required data
})
</script>

<style scoped>
.dashboard-layout {
  @apply flex h-screen bg-gradient-light text-soft-800 overflow-hidden;
}

/* Sidebar Styles */
.sidebar {
  @apply flex flex-col bg-white/90 border-r border-soft-200 transition-all duration-300 ease-in-out shadow-sm;
  width: 280px;
  backdrop-filter: blur(20px);
}

.sidebar-collapsed {
  width: 80px;
}

.sidebar-header {
  @apply flex items-center justify-between p-4 border-b border-soft-200;
}

.logo {
  @apply flex items-center gap-3 cursor-pointer;
}

.logo-icon {
  @apply w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600;
}

.logo-text {
  @apply text-xl font-bold text-soft-800;
}

.sidebar-toggle {
  @apply p-2 rounded-lg hover:bg-soft-100 transition-all duration-200 text-soft-600;
}

.sidebar-toggle.rotated {
  @apply rotate-180;
}

.sidebar-nav {
  @apply flex-1 overflow-y-auto p-4;
}

.nav-section {
  @apply mb-8;
}

.nav-title {
  @apply text-xs font-semibold text-soft-500 uppercase tracking-wider mb-3 px-3;
}

.nav-item {
  @apply flex items-center gap-3 px-3 py-2.5 rounded-lg text-soft-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 mb-1 no-underline;
}

.nav-item-active {
  @apply bg-primary-100 text-primary-700 font-medium;
}

.nav-icon {
  @apply w-5 h-5 flex-shrink-0;
}

.nav-text {
  @apply flex-1 text-sm;
}

.nav-badge {
  @apply bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full;
}

.user-section {
  @apply mt-auto p-4 border-t border-soft-200;
}

.user-profile {
  @apply flex items-center gap-3 p-3 rounded-lg hover:bg-soft-50 cursor-pointer transition-all duration-200;
}

.user-avatar {
  @apply w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-medium text-sm;
}

.user-info {
  @apply flex-1;
}

.user-name {
  @apply text-sm font-medium text-soft-800;
}

.user-role {
  @apply text-xs text-soft-500;
}

.user-menu {
  @apply mt-2 bg-white rounded-lg shadow-lg border border-soft-200 py-2;
}

.user-menu-item {
  @apply flex items-center gap-3 px-4 py-2 text-sm text-soft-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 w-full;
}

/* Main Content Styles */
.main-content {
  @apply flex-1 flex flex-col overflow-hidden;
}

.main-header {
  @apply flex items-center justify-between p-6 bg-white/80 border-b border-soft-200 shadow-sm;
  backdrop-filter: blur(20px);
}

.header-left {
  @apply flex-1;
}

.page-title {
  @apply text-2xl font-bold mb-1 text-soft-800;
}

.breadcrumb {
  @apply flex items-center gap-2 text-sm text-soft-500;
}

.breadcrumb-item {
  @apply flex items-center gap-2;
}

.header-right {
  @apply flex items-center gap-4;
}

.search-box {
  @apply relative;
}

.search-icon {
  @apply absolute left-3 top-1/2 transform -translate-y-1/2 text-soft-400;
}

.search-input {
  @apply pl-10 pr-4 py-2 bg-white border border-soft-300 rounded-xl text-soft-800 placeholder-soft-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200;
  width: 300px;
}

.header-btn {
  @apply p-2 rounded-xl hover:bg-soft-100 transition-all duration-200 relative text-soft-600;
}

.notification-badge {
  @apply absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center;
}

.page-content {
  @apply flex-1 overflow-auto p-6;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
}

/* Notification Panel */
.notification-panel {
  @apply absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-soft-200 py-4 z-50;
}

.notification-header {
  @apply flex items-center justify-between px-4 pb-3 border-b border-soft-200;
}

.notification-title {
  @apply font-semibold text-soft-800;
}

.notification-list {
  @apply max-h-80 overflow-y-auto;
}

.notification-item {
  @apply flex items-start gap-3 p-4 hover:bg-soft-50 transition-all duration-200 border-b border-soft-100 last:border-b-0;
}

.notification-icon {
  @apply w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0;
}

.notification-content {
  @apply flex-1;
}

.notification-message {
  @apply text-sm text-soft-800 mb-1;
}

.notification-time {
  @apply text-xs text-soft-500;
}

.notification-actions {
  @apply flex items-center gap-2 px-4 pt-3 border-t border-soft-200;
}

/* Animations */
.fade-enter-active, .fade-leave-active {
  @apply transition-opacity duration-200;
}

.fade-enter-from, .fade-leave-to {
  @apply opacity-0;
}

.slide-up-enter-active, .slide-up-leave-active {
  @apply transition-all duration-200;
}

.slide-up-enter-from, .slide-up-leave-to {
  @apply opacity-0 transform translate-y-2;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    @apply fixed left-0 top-0 h-full z-40;
    transform: translateX(-100%);
  }
  
  .sidebar.sidebar-open {
    @apply transform-none;
  }
  
  .main-content {
    @apply ml-0;
  }
  
  .search-input {
    width: 200px;
  }
  
  .header-right {
    @apply gap-2;
  }
  
  .notification-panel {
    @apply w-72;
  }
}
</style>