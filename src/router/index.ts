import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

// 页面组件
const Dashboard = () => import('@/pages/Dashboard.vue')
const Demo = () => import('@/pages/Demo.vue')

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/demo'
  },
  {
    path: '/demo',
    name: 'Demo',
    component: Demo,
    meta: {
      title: 'UI 设计系统展示',
      requiresAuth: false,
      icon: 'demo'
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      title: '仪表盘',
      requiresAuth: true,
      icon: 'dashboard'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/NotFound.vue'),
    meta: {
      title: '页面未找到'
    }
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - DevOps 平台`
  }
  
  // 检查认证状态
  const token = localStorage.getItem('auth-token')
  const requiresAuth = to.meta?.requiresAuth !== false
  
  if (requiresAuth && !token) {
    // 暂时跳过认证检查，直接允许访问
    next()
  } else {
    next()
  }
})

export default router