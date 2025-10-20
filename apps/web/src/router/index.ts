import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import Apps from "@/views/Apps.vue";
import ComponentDemo from "@/views/ComponentDemo.vue";
import Dashboard from "@/views/Dashboard.vue";
import Documents from "@/views/Documents.vue";
import Home from "@/views/Home.vue";
import Login from "@/views/Login.vue";
import Settings from "@/views/Settings.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "apps",
          component: Apps,
        },
        {
          path: "documents",
          name: "documents",
          component: Documents,
        },
        {
          path: "dashboard",
          name: "dashboard",
          component: Dashboard,
        },
        {
          path: "pipelines",
          name: "pipelines",
          component: Apps, // 暂时使用 Apps 组件，后续可以创建专门的组件
        },
        {
          path: "deployments",
          name: "deployments",
          component: Apps, // 暂时使用 Apps 组件，后续可以创建专门的组件
        },
        {
          path: "monitoring",
          name: "monitoring",
          component: Apps, // 暂时使用 Apps 组件，后续可以创建专门的组件
        },
        {
          path: "settings",
          name: "settings",
          component: Settings,
        },
        {
          path: "demo",
          name: "demo",
          component: ComponentDemo,
        },
      ],
    },
    {
      path: "/login",
      name: "login",
      component: Login,
    },
    {
      path: "/home",
      name: "home",
      component: Home,
    },
  ],
});

// 路由守卫：设置页面标题和认证检查
router.beforeEach(async (to, from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string;
  }

  // 检查是否需要认证
  if (to.meta?.requiresAuth) {
    // 这里可以添加认证检查逻辑
    // 暂时允许所有访问，具体认证在组件内处理
  }

  next();
});

export default router;
