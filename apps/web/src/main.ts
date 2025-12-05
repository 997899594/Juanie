// 应用组件与路由

import { VueQueryPlugin } from '@tanstack/vue-query'
import { MotionPlugin } from '@vueuse/motion'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { setupObservability } from './lib/observability'
import { queryClient } from './lib/query-client'
import { setupErrorHandler } from './plugins/error-handler'
import router from './router'

// 导入样式
import './styles/main.css'
import '@juanie/ui/styles'

// 初始化可观测性（必须在应用创建前）
setupObservability()

// 创建应用实例
const app = createApp(App)

// 创建状态管理
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 注册插件
app.use(router)
app.use(pinia)
app.use(VueQueryPlugin, { queryClient })
app.use(MotionPlugin)

// 设置错误处理
setupErrorHandler(app)

// 挂载应用
app.mount('#app')
