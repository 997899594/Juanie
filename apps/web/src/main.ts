import { createPinia } from 'pinia'
import { createApp } from 'vue'

// 主题配置已统一到 App.vue 中

// UnoCSS
import 'virtual:uno.css'

// 应用组件
import App from './App.vue'

// 路由配置
import router from './router'

// 创建应用实例
const app = createApp(App)

// 创建状态管理
const pinia = createPinia()

// 注册插件
app.use(router)
app.use(pinia)

// 挂载应用
app.mount('#app')
