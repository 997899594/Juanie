import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

// 路由配置
const routes: RouteRecordRaw[] = []

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
})

// 路由守卫
router.beforeEach((to, _from, next) => {
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
