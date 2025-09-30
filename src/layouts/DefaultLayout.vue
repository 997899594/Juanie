<template>
  <div class="default-layout">
    <!-- 主要布局容器 -->
    <n-layout has-sider class="layout-container">
      <!-- 侧边栏 -->
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="240"
        :collapsed="collapsed"
        show-trigger
        @collapse="collapsed = true"
        @expand="collapsed = false"
        class="layout-sider"
      >
        <!-- Logo 区域 -->
        <div class="logo-section">
          <div class="logo-container" :class="{ collapsed }">
            <div class="logo-icon">
              <span class="text-2xl">🚀</span>
            </div>
            <transition name="fade">
              <div v-if="!collapsed" class="logo-text">
                <h2 class="text-lg font-bold text-bilibili-primary">
                  DevOps
                </h2>
                <p class="text-xs text-bilibili-muted">
                  企业级平台
                </p>
              </div>
            </transition>
          </div>
        </div>
        
        <!-- 导航菜单 -->
        <n-menu
          :collapsed="collapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
          :value="activeKey"
          class="sidebar-menu"
          @update:value="handleMenuSelect"
        />
        
        <!-- 用户信息区域 -->
        <div class="user-section" :class="{ collapsed }">
          <div class="user-info">
            <n-avatar
              round
              size="small"
              src="/default-avatar.svg"
              fallback-src="/default-avatar.svg"
            />
            <transition name="fade">
              <div v-if="!collapsed" class="user-details">
                <p class="text-sm font-medium text-bilibili-primary">
                  管理员
                </p>
                <p class="text-xs text-bilibili-muted">
                  在线
                </p>
              </div>
            </transition>
          </div>
        </div>
      </n-layout-sider>
      
      <!-- 主内容区域 -->
      <n-layout class="main-layout">
        <!-- 顶部导航栏 -->
        <n-layout-header bordered class="layout-header">
          <div class="header-content">
            <!-- 左侧：面包屑导航 -->
            <div class="header-left">
              <n-breadcrumb class="breadcrumb-nav">
                <n-breadcrumb-item
                  v-for="item in breadcrumbItems"
                  :key="item.path"
                  :clickable="!!item.path"
                  @click="item.path && $router.push(item.path)"
                >
                  <span v-if="item.icon" class="mr-1">{{ item.icon }}</span>
                  {{ item.title }}
                </n-breadcrumb-item>
              </n-breadcrumb>
            </div>
            
            <!-- 右侧：用户操作 -->
            <div class="header-right">
              <div class="header-actions">
                <!-- 主题切换 -->
                <n-tooltip trigger="hover" placement="bottom">
                  <template #trigger>
                    <n-button
                      quaternary
                      circle
                      class="action-btn animate-bilibili-hover"
                      @click="toggleTheme"
                    >
                      <span class="text-lg">{{ themeStore.isDark ? '🌙' : '☀️' }}</span>
                    </n-button>
                  </template>
                  切换{{ themeStore.isDark ? '浅色' : '深色' }}主题
                </n-tooltip>
                
                <!-- 通知 -->
                <n-tooltip trigger="hover" placement="bottom">
                  <template #trigger>
                    <n-badge :value="3" :max="99">
                      <n-button
                        quaternary
                        circle
                        class="action-btn animate-bilibili-hover"
                        @click="showNotifications"
                      >
                        <span class="text-lg">🔔</span>
                      </n-button>
                    </n-badge>
                  </template>
                  通知消息
                </n-tooltip>
                
                <!-- 设置 -->
                <n-tooltip trigger="hover" placement="bottom">
                  <template #trigger>
                    <n-button
                      quaternary
                      circle
                      class="action-btn animate-bilibili-hover"
                      @click="showSettings"
                    >
                      <span class="text-lg">⚙️</span>
                    </n-button>
                  </template>
                  系统设置
                </n-tooltip>
                
                <!-- 用户菜单 -->
                <n-dropdown
                  trigger="click"
                  :options="userMenuOptions"
                  @select="handleUserMenuSelect"
                >
                  <n-button quaternary class="user-menu-btn animate-bilibili-hover">
                    <div class="flex-center gap-bilibili-sm">
                      <n-avatar
                        round
                        size="small"
                        src="/default-avatar.svg"
                        fallback-src="/default-avatar.svg"
                      />
                      <span class="text-sm font-medium">管理员</span>
                      <span class="text-xs">▼</span>
                    </div>
                  </n-button>
                </n-dropdown>
              </div>
            </div>
          </div>
        </n-layout-header>
        
        <!-- 主要内容区域 -->
        <n-layout-content class="layout-content">
          <div class="content-wrapper">
            <!-- 路由视图 -->
            <router-view v-slot="{ Component }">
              <transition name="page" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </div>
        </n-layout-content>
        
        <!-- 底部 -->
        <n-layout-footer bordered class="layout-footer">
          <div class="footer-content">
            <div class="footer-left">
              <p class="text-sm text-bilibili-muted">
                © 2024 DevOps Platform. 基于 Vue 3 + Naive UI 构建
              </p>
            </div>
            <div class="footer-right">
              <div class="footer-links">
                <a href="#" class="footer-link">帮助文档</a>
                <a href="#" class="footer-link">API 文档</a>
                <a href="#" class="footer-link">反馈建议</a>
              </div>
            </div>
          </div>
        </n-layout-footer>
      </n-layout>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import type { MenuOption } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

// 侧边栏折叠状态
const collapsed = ref(false)

// 当前激活的菜单项
const activeKey = computed(() => route.path)

// 菜单选项
const menuOptions: MenuOption[] = [
  {
    label: '仪表盘',
    key: '/',
    icon: () => '📊'
  },
  {
    label: '项目管理',
    key: '/projects',
    icon: () => '📁',
    children: [
      {
        label: '项目列表',
        key: '/projects',
        icon: () => '📋'
      },
      {
        label: '新建项目',
        key: '/projects/new',
        icon: () => '➕'
      }
    ]
  },
  {
    label: '部署中心',
    key: '/deploy',
    icon: () => '🚀',
    children: [
      {
        label: '部署历史',
        key: '/deploy/history',
        icon: () => '📜'
      },
      {
        label: '环境管理',
        key: '/deploy/environments',
        icon: () => '🌍'
      }
    ]
  },
  {
    label: '系统监控',
    key: '/monitor',
    icon: () => '📈',
    children: [
      {
        label: '性能监控',
        key: '/monitor/performance',
        icon: () => '⚡'
      },
      {
        label: '日志管理',
        key: '/monitor/logs',
        icon: () => '📝'
      }
    ]
  },
  {
    label: '用户管理',
    key: '/users',
    icon: () => '👥'
  },
  {
    label: '系统设置',
    key: '/settings',
    icon: () => '⚙️'
  }
]

// 用户菜单选项
const userMenuOptions = [
  {
    label: '个人资料',
    key: 'profile',
    icon: () => '👤'
  },
  {
    label: '账户设置',
    key: 'account',
    icon: () => '⚙️'
  },
  {
    type: 'divider',
    key: 'd1'
  },
  {
    label: '退出登录',
    key: 'logout',
    icon: () => '🚪'
  }
]

// 面包屑导航
const breadcrumbItems = computed(() => {
  const items = [
    { title: '首页', icon: '🏠', path: '/' }
  ]
  
  // 根据当前路由生成面包屑
  const pathSegments = route.path.split('/').filter(Boolean)
  let currentPath = ''
  
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`
    
    // 根据路径生成标题
    let title = segment
    let icon = ''
    
    switch (segment) {
      case 'projects':
        title = '项目管理'
        icon = '📁'
        break
      case 'deploy':
        title = '部署中心'
        icon = '🚀'
        break
      case 'monitor':
        title = '系统监控'
        icon = '📈'
        break
      case 'users':
        title = '用户管理'
        icon = '👥'
        break
      case 'settings':
        title = '系统设置'
        icon = '⚙️'
        break
    }
    
    items.push({
      title,
      icon,
      path: index === pathSegments.length - 1 ? '' : currentPath
    })
  })
  
  return items
})

// 处理菜单选择
const handleMenuSelect = (key: string) => {
  if (key !== route.path) {
    router.push(key)
  }
}

// 处理用户菜单选择
const handleUserMenuSelect = (key: string) => {
  switch (key) {
    case 'profile':
      console.log('查看个人资料')
      break
    case 'account':
      console.log('账户设置')
      break
    case 'logout':
      console.log('退出登录')
      break
  }
}

// 切换主题
const toggleTheme = () => {
  themeStore.toggleDark()
}

// 显示通知
const showNotifications = () => {
  console.log('显示通知')
}

// 显示设置
const showSettings = () => {
  router.push('/settings')
}

// 监听路由变化，自动展开对应的菜单项
watch(
  () => route.path,
  () => {
    // 这里可以添加自动展开菜单的逻辑
  },
  { immediate: true }
)
</script>

<style scoped>
.default-layout {
  height: 100vh;
  overflow: hidden;
}

.layout-container {
  height: 100vh;
}

.layout-sider {
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-light);
}

.logo-section {
  padding: var(--spacing-4);
  border-bottom: 1px solid var(--border-light);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  transition: all var(--duration-normal) ease;
}

.logo-container.collapsed {
  justify-content: center;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--gradient-bilibili);
  color: var(--text-inverse);
  flex-shrink: 0;
}

.logo-text {
  min-width: 0;
}

.sidebar-menu {
  padding: var(--spacing-2) 0;
  background: transparent;
}

.user-section {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-4);
  border-top: 1px solid var(--border-light);
  background: var(--bg-sidebar);
}

.user-section.collapsed {
  padding: var(--spacing-2);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.user-section.collapsed .user-info {
  justify-content: center;
}

.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.layout-header {
  height: var(--header-height);
  padding: 0 var(--spacing-6);
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.header-left {
  flex: 1;
}

.breadcrumb-nav {
  font-size: var(--font-size-sm);
}

.header-right {
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.action-btn {
  width: 40px;
  height: 40px;
  transition: all var(--duration-fast) ease;
}

.action-btn:hover {
  background: var(--bilibili-pink-ultra-light);
  transform: scale(1.05);
}

.user-menu-btn {
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) ease;
}

.user-menu-btn:hover {
  background: var(--bilibili-pink-ultra-light);
}

.layout-content {
  flex: 1;
  overflow: hidden;
  background: var(--bg-page);
}

.content-wrapper {
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-6);
}

.layout-footer {
  height: var(--footer-height);
  padding: 0 var(--spacing-6);
  background: var(--bg-footer);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.footer-links {
  display: flex;
  gap: var(--spacing-4);
}

.footer-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: color var(--duration-fast) ease;
}

.footer-link:hover {
  color: var(--bilibili-pink);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-enter-active,
.page-leave-active {
  transition: all var(--duration-normal) ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 var(--spacing-4);
  }
  
  .content-wrapper {
    padding: var(--spacing-4);
  }
  
  .footer-content {
    flex-direction: column;
    gap: var(--spacing-2);
    text-align: center;
  }
  
  .footer-links {
    gap: var(--spacing-2);
  }
}
</style>