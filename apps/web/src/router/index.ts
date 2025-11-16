import { Home } from 'lucide-vue-next'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
// 只导入布局组件和登录页（需要立即加载）
import AppLayout from '@/layouts/AppLayout.vue'
import Apps from '@/views/Apps.vue'
import Login from '@/views/Login.vue'

// 扩展路由元数据类型
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    // 导航菜单配置
    navigation?: {
      group: string
      icon: string
      order: number
      badge?: string
      hidden?: boolean
    }
  }
}

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      // 应用管理模块
      {
        path: '',
        name: 'apps',
        component: Apps,
        meta: {
          title: '应用管理',
          navigation: {
            group: '应用管理',
            icon: 'AppWindow',
            order: 1,
          },
        },
      },
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/views/Projects.vue'),
        meta: {
          title: '项目管理',
          navigation: {
            group: '应用管理',
            icon: 'FolderOpen',
            order: 2,
          },
        },
      },
      {
        path: 'projects/:id',
        name: 'project-detail',
        component: () => import('@/views/ProjectDetail.vue'),
        props: true,
        meta: {
          title: '项目详情',
          navigation: { hidden: true, group: '', icon: '', order: 0 },
        },
      },
      {
        path: 'pipelines',
        name: 'pipelines',
        component: () => import('@/views/Pipelines.vue'),
        meta: {
          title: '流水线',
          navigation: {
            group: '应用管理',
            icon: 'GitBranch',
            order: 3,
          },
        },
      },
      {
        path: 'deployments',
        name: 'deployments',
        component: () => import('@/views/Deployments.vue'),
        meta: {
          title: '部署记录',
          navigation: {
            group: '应用管理',
            icon: 'Rocket',
            order: 4,
          },
        },
      },
      {
        path: 'deployments/:id',
        name: 'deployment-detail',
        component: () => import('@/views/DeploymentDetail.vue'),
        props: true,
        meta: {
          title: '部署详情',
          navigation: { hidden: true, group: '', icon: '', order: 0 },
        },
      },

      // AI 智能化模块
      {
        path: 'ai/assistants',
        name: 'ai-assistants',
        component: () => import('@/views/ai/AIAssistants.vue'),
        meta: {
          title: 'AI 助手',
          navigation: {
            group: 'AI 智能化',
            icon: 'Bot',
            order: 1,
            badge: 'Beta',
          },
        },
      },
      {
        path: 'ai/recommendations',
        name: 'ai-recommendations',
        component: () => import('@/views/ai/AIRecommendations.vue'),
        meta: {
          title: '智能推荐',
          navigation: {
            group: 'AI 智能化',
            icon: 'Brain',
            order: 2,
          },
        },
      },
      {
        path: 'ai/code-analysis',
        name: 'ai-code-analysis',
        component: () => import('@/views/ai/CodeAnalysis.vue'),
        meta: {
          title: '代码分析',
          navigation: {
            group: 'AI 智能化',
            icon: 'Code',
            order: 3,
          },
        },
      },

      // 安全与合规模块
      {
        path: 'security/zero-trust',
        name: 'security-zero-trust',
        component: () => import('@/views/security/ZeroTrust.vue'),
        meta: {
          title: '零信任策略',
          navigation: {
            group: '安全与合规',
            icon: 'Shield',
            order: 1,
            badge: 'New',
          },
        },
      },
      {
        path: 'security/vulnerabilities',
        name: 'security-vulnerabilities',
        component: () => import('@/views/security/Vulnerabilities.vue'),
        meta: {
          title: '漏洞扫描',
          navigation: {
            group: '安全与合规',
            icon: 'AlertTriangle',
            order: 2,
          },
        },
      },
      {
        path: 'security/policies',
        name: 'security-policies',
        component: () => import('@/views/security/SecurityPolicies.vue'),
        meta: {
          title: '安全策略',
          navigation: {
            group: '安全与合规',
            icon: 'Lock',
            order: 3,
          },
        },
      },
      {
        path: 'security/audit-logs',
        name: 'security-audit-logs',
        component: () => import('@/views/security/AuditLogs.vue'),
        meta: {
          title: '审计日志',
          navigation: {
            group: '安全与合规',
            icon: 'FileSearch',
            order: 4,
          },
        },
      },

      // 监控与分析模块
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '仪表盘',
          navigation: {
            group: '监控与分析',
            icon: 'BarChart3',
            order: 1,
          },
        },
      },
      {
        path: 'monitoring',
        name: 'monitoring',
        component: () => import('@/views/Monitoring.vue'),
        meta: {
          title: '性能监控',
          navigation: {
            group: '监控与分析',
            icon: 'Activity',
            order: 2,
          },
        },
      },
      {
        path: 'monitoring/alerts',
        name: 'monitoring-alerts',
        component: () => import('@/views/monitoring/IntelligentAlerts.vue'),
        meta: {
          title: '智能告警',
          navigation: {
            group: '监控与分析',
            icon: 'Bell',
            order: 3,
          },
        },
      },
      {
        path: 'monitoring/incidents',
        name: 'monitoring-incidents',
        component: () => import('@/views/monitoring/IncidentManagement.vue'),
        meta: {
          title: '事件管理',
          navigation: {
            group: '监控与分析',
            icon: 'AlertCircle',
            order: 4,
          },
        },
      },
      {
        path: 'monitoring/performance-metrics',
        name: 'monitoring-performance-metrics',
        component: () => import('@/views/monitoring/PerformanceMetrics.vue'),
        meta: {
          title: '性能指标',
          navigation: {
            group: '监控与分析',
            icon: 'TrendingUp',
            order: 5,
          },
        },
      },
      {
        path: 'observability',
        name: 'observability',
        component: () => import('@/views/Observability.vue'),
        meta: {
          title: '可观测性',
          navigation: {
            group: '监控与分析',
            icon: 'Eye',
            order: 6,
          },
        },
      },
      {
        path: 'alerts',
        name: 'alerts',
        component: () => import('@/views/Alerts.vue'),
        meta: {
          title: '监控告警',
          navigation: {
            group: '监控与分析',
            icon: 'AlertCircle',
            order: 7,
          },
        },
      },

      // 成本与可持续性模块
      {
        path: 'cost/tracking',
        name: 'cost-tracking',
        component: () => import('@/views/cost/CostTracking.vue'),
        meta: {
          title: '成本跟踪',
          navigation: {
            group: '成本与可持续性',
            icon: 'DollarSign',
            order: 1,
          },
        },
      },
      {
        path: 'cost/optimization',
        name: 'cost-optimization',
        component: () => import('@/views/cost/ResourceOptimization.vue'),
        meta: {
          title: '资源优化',
          navigation: {
            group: '成本与可持续性',
            icon: 'TrendingUp',
            order: 2,
          },
        },
      },
      {
        path: 'cost/resource-usage',
        name: 'cost-resource-usage',
        component: () => import('@/views/cost/ResourceUsage.vue'),
        meta: {
          title: '资源使用',
          navigation: {
            group: '成本与可持续性',
            icon: 'Server',
            order: 3,
          },
        },
      },
      {
        path: 'sustainability/metrics',
        name: 'sustainability-metrics',
        component: () => import('@/views/sustainability/SustainabilityMetrics.vue'),
        meta: {
          title: '可持续性指标',
          navigation: {
            group: '成本与可持续性',
            icon: 'Leaf',
            order: 4,
            badge: 'ESG',
          },
        },
      },

      // 实验与创新模块
      {
        path: 'experiments/ab-testing',
        name: 'experiments-ab-testing',
        component: () => import('@/views/experiments/ABTesting.vue'),
        meta: {
          title: 'A/B 测试',
          navigation: {
            group: '实验与创新',
            icon: 'TestTube',
            order: 1,
          },
        },
      },
      {
        path: 'experiments/feature-flags',
        name: 'experiments-feature-flags',
        component: () => import('@/views/experiments/FeatureFlags.vue'),
        meta: {
          title: '特性开关',
          navigation: {
            group: '实验与创新',
            icon: 'ToggleLeft',
            order: 2,
          },
        },
      },

      // 团队与权限管理模块
      {
        path: 'teams',
        name: 'teams',
        component: () => import('@/views/teams/Teams.vue'),
        meta: {
          title: '团队管理',
          navigation: {
            group: '团队与权限',
            icon: 'Users',
            order: 1,
          },
        },
      },
      {
        path: 'roles',
        name: 'roles',
        component: () => import('@/views/teams/Roles.vue'),
        meta: {
          title: '角色管理',
          navigation: {
            group: '团队与权限',
            icon: 'UserCheck',
            order: 2,
          },
        },
      },
      {
        path: 'organizations',
        name: 'organizations',
        component: () => import('@/views/organizations/Organizations.vue'),
        meta: {
          title: '组织管理',
          navigation: {
            group: '团队与权限',
            icon: 'Building',
            order: 3,
          },
        },
      },
      {
        path: 'organizations/:id',
        name: 'organization-detail',
        component: () => import('@/views/organizations/OrganizationDetail.vue'),
        props: true,
        meta: {
          title: '组织详情',
          navigation: { hidden: true, group: '', icon: '', order: 0 },
        },
      },

      // 集成与自动化模块
      {
        path: 'repositories',
        name: 'repositories',
        component: () => import('@/views/repositories/Repositories.vue'),
        meta: {
          title: '代码仓库',
          navigation: {
            group: '集成与自动化',
            icon: 'GitBranch',
            order: 1,
          },
        },
      },
      {
        path: 'gitops/resources',
        name: 'gitops-resources',
        component: () => import('@/views/gitops/GitOpsResources.vue'),
        meta: {
          title: 'GitOps 资源',
          navigation: {
            group: '集成与自动化',
            icon: 'Boxes',
            order: 2,
            badge: 'New',
          },
        },
      },
      {
        path: 'gitops/settings',
        name: 'gitops-settings',
        component: () => import('@/views/gitops/GitOpsSettings.vue'),
        meta: {
          title: 'GitOps 设置',
          navigation: {
            group: '集成与自动化',
            icon: 'Settings',
            order: 3,
          },
        },
      },
      {
        path: 'webhooks',
        name: 'webhooks',
        component: () => import('@/views/integrations/Webhooks.vue'),
        meta: {
          title: 'Webhook 管理',
          navigation: {
            group: '集成与自动化',
            icon: 'Webhook',
            order: 4,
          },
        },
      },
      {
        path: 'events',
        name: 'events',
        component: () => import('@/views/integrations/Events.vue'),
        meta: {
          title: '事件管理',
          navigation: {
            group: '集成与自动化',
            icon: 'Zap',
            order: 5,
          },
        },
      },

      // 通知中心
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/Notifications.vue'),
        meta: {
          title: '通知中心',
          navigation: {
            group: '监控与分析',
            icon: 'Bell',
            order: 8,
          },
        },
      },

      // 文档与设置模块
      {
        path: 'documents',
        name: 'documents',
        component: () => import('@/views/Documents.vue'),
        meta: {
          title: '文档',
          navigation: {
            group: '文档与设置',
            icon: 'FileText',
            order: 1,
          },
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/Settings.vue'),
        meta: {
          title: '设置',
          navigation: {
            group: '文档与设置',
            icon: 'Settings',
            order: 2,
          },
        },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/Onboarding.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/home',
    name: 'home',
    component: Home,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 路由守卫：设置页面标题和认证检查
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - Juanie`
  } else {
    document.title = 'Juanie - AI DevOps 平台'
  }

  // 检查是否需要认证
  if (to.meta?.requiresAuth) {
    // 动态导入 auth store 以避免循环依赖
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // 如果还没有初始化，先初始化认证状态
    if (!authStore.initialized) {
      await authStore.initialize()
    }

    // 如果未认证，跳转到登录页
    if (!authStore.isAuthenticated) {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
  }

  // 如果已认证且访问登录页，重定向到首页
  if (to.name === 'login') {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    if (authStore.isAuthenticated) {
      next({ name: 'apps' })
      return
    }
  }

  next()
})

// 导出导航菜单配置生成函数
export const generateNavigationConfig = () => {
  const navigationGroups: Record<
    string,
    Array<{
      name: string
      path: string
      title: string
      icon: string
      badge?: string
      order: number
    }>
  > = {}

  // 遍历路由，提取导航配置
  const extractNavigation = (routes: RouteRecordRaw[], parentPath = '') => {
    routes.forEach((route) => {
      if (route.meta?.navigation && !route.meta.navigation.hidden) {
        const { group, icon, order, badge } = route.meta.navigation
        const fullPath = parentPath + (route.path.startsWith('/') ? route.path : `/${route.path}`)

        if (!navigationGroups[group]) {
          navigationGroups[group] = []
        }

        navigationGroups[group].push({
          name: route.name as string,
          path: fullPath,
          title: route.meta.title || '',
          icon,
          badge,
          order,
        })
      }

      // 递归处理子路由
      if (route.children) {
        extractNavigation(route.children, parentPath + route.path)
      }
    })
  }

  extractNavigation(routes)

  // 对每个组内的项目按 order 排序
  Object.keys(navigationGroups).forEach((group) => {
    navigationGroups[group]?.sort((a, b) => a.order - b.order)
  })

  return navigationGroups
}

export default router
