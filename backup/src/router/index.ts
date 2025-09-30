import type { RouteRecordRaw } from 'vue-router'

// Layouts
import AuthLayout from '@/layouts/AuthLayout.vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'

// Auth Pages
import Login from '@/pages/auth/Login.vue'
import Register from '@/pages/auth/Register.vue'

// Dashboard Pages
import Dashboard from '@/pages/Dashboard.vue'
import Projects from '@/pages/Projects.vue'
import ProjectDetail from '@/pages/ProjectDetail.vue'
import Pipelines from '@/pages/Pipelines.vue'
import Deployments from '@/pages/Deployments.vue'
import CodeQuality from '@/pages/CodeQuality.vue'
import Monitoring from '@/pages/Monitoring.vue'
import Config from '@/pages/Config.vue'
import Settings from '@/pages/Settings.vue'
import Profile from '@/pages/Profile.vue'
import Users from '@/pages/Users.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  // 独立的登录页面 - 不使用AuthLayout包裹
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { public: true },
  },
  {
    path: '/auth',
    component: AuthLayout,
    meta: { public: true },
    children: [
      {
        path: '/register',
        name: 'Register',
        component: Register,
        meta: { public: true },
      },
    ],
  },
  {
    path: '/',
    component: DashboardLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: { requiresAuth: true, title: '仪表板' },
      },
      {
        path: '/projects',
        name: 'Projects',
        component: Projects,
        meta: { requiresAuth: true, title: '项目管理' },
      },
      {
        path: '/projects/:id',
        name: 'ProjectDetail',
        component: ProjectDetail,
        meta: { requiresAuth: true, title: '项目详情' },
      },
      {
        path: '/pipelines',
        name: 'Pipelines',
        component: Pipelines,
        meta: { requiresAuth: true, title: 'CI/CD流水线' },
      },
      {
        path: '/deployments',
        name: 'Deployments',
        component: Deployments,
        meta: { requiresAuth: true, title: '部署管理' },
      },
      {
        path: '/code-quality',
        name: 'CodeQuality',
        component: CodeQuality,
        meta: { requiresAuth: true, title: '代码质量' },
      },
      {
        path: '/monitoring',
        name: 'Monitoring',
        component: Monitoring,
        meta: { requiresAuth: true, title: '监控告警' },
      },
      {
        path: '/config',
        name: 'Config',
        component: Config,
        meta: { requiresAuth: true, title: '配置管理' },
      },
      {
        path: '/settings',
        name: 'Settings',
        component: Settings,
        meta: { requiresAuth: true, title: '系统设置' },
      },
      {
        path: '/profile',
        name: 'Profile',
        component: Profile,
        meta: { requiresAuth: true, title: '个人资料' },
      },
      {
        path: '/users',
        name: 'Users',
        component: Users,
        meta: { requiresAuth: true, title: '用户管理' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]