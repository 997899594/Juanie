import { demo } from "@juanie/ui/demo";
import { createRouter, createWebHistory } from "vue-router";
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
      path: "/theme-demo",
      name: "ThemeDemo",
      component: demo,
      meta: {
        title: "Juanie 主题系统演示",
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
