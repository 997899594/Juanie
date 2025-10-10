// 应用组件与路由
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

import "@juanie/ui/styles";

// 创建应用实例
const app = createApp(App);

// 创建状态管理
const pinia = createPinia();

// 注册插件
app.use(router);
app.use(pinia);

// 挂载应用
app.mount("#app");
