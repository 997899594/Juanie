// 应用组件与路由

import { MotionPlugin } from '@vueuse/motion'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 导入样式
import './styles/main.css'

// 创建应用实例
const app = createApp(App)

// 创建状态管理
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 注册插件
app.use(router)
app.use(pinia)
app.use(MotionPlugin)

// 挂载应用
app.mount('#app')
