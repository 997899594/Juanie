import { createPinia } from 'pinia'
import { createApp } from 'vue'

// 应用组件
import App from './App.vue'

// 路由配置
import router from './router'

// 样式
import './app.css'

// 创建应用实例
const app = createApp(App)

// 创建状态管理
const pinia = createPinia()

// 注册插件
app.use(router)
app.use(pinia)

// 挂载应用
app.mount('#app')
