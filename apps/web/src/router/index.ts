import { createRouter, createWebHistory } from "vue-router";
import ComponentDemo from "../views/ComponentDemo.vue";
import Home from "../views/Home.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Home",
      component: Home,
    },
    {
      path: "/demo",
      name: "ComponentDemo",
      component: ComponentDemo,
      meta: {
        title: "Juanie UI 组件库演示",
      },
    },
  ],
});

// 路由守卫：设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string;
  }
  next();
});

export default router;
