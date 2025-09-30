import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import naive from 'naive-ui'
import './style.css'
import App from './App.vue'
import { routes } from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Initialize auth state if not already done
  if (!authStore.user && authStore.accessToken) {
    await authStore.initializeAuth()
  }
  
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isPublicRoute = to.matched.some(record => record.meta.public)
  
  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (isPublicRoute && authStore.isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

app.use(pinia)
app.use(router)
app.use(naive)

app.mount('#app')
