import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type RouterInput = inferRouterInputs<AppRouter>
type ProjectTemplate = RouterOutput['projectTemplates']['list'][number]
type TemplateDetail = RouterOutput['projectTemplates']['get']

/**
 * 项目模板管理组合式函数
 * 提供模板的查询、渲染和创建功能
 */
export function useTemplates() {
  const toast = useToast()

  // 状态
  const templates = ref<ProjectTemplate[]>([])
  const currentTemplate = ref<TemplateDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 筛选状态
  const categoryFilter = ref<string | undefined>(undefined)
  const searchQuery = ref<string>('')
  const showPublicOnly = ref(true)

  // 计算属性
  const hasTemplates = computed(() => templates.value.length > 0)

  /**
   * 过滤后的模板列表
   */
  const filteredTemplates = computed(() => {
    let result = templates.value

    // 按分类筛选
    if (categoryFilter.value) {
      result = result.filter((t) => t.category === categoryFilter.value)
    }

    // 按搜索关键词筛选
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query)),
      )
    }

    // 按可见性筛选
    if (showPublicOnly.value) {
      result = result.filter((t) => t.isPublic)
    }

    return result
  })

  /**
   * 按分类分组的模板
   */
  const templatesByCategory = computed(() => {
    const grouped: Record<string, ProjectTemplate[]> = {}

    filteredTemplates.value.forEach((template) => {
      if (!grouped[template.category]) {
        grouped[template.category] = []
      }
      grouped[template.category]!.push(template)
    })

    return grouped
  })

  /**
   * 获取所有模板列表
   */
  async function listTemplates(filters?: {
    category?: 'web' | 'api' | 'microservice' | 'static' | 'fullstack' | 'mobile' | 'data'
    isPublic?: boolean
    organizationId?: string
  }) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projectTemplates.list.query(filters || {})
      templates.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch templates:', err)
      error.value = '获取模板列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取模板列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取模板详情
   */
  async function getTemplate(templateId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projectTemplates.get.query({ templateId })
      currentTemplate.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch template:', err)
      error.value = '获取模板详情失败'

      if (isTRPCClientError(err)) {
        toast.error('获取模板详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 渲染模板（填充变量）
   */
  async function renderTemplate(
    templateId: string,
    variables: {
      projectName: string
      projectSlug: string
      namespace: string
      image: string
      imageTag: string
      imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never'
      replicas: number
      resources: {
        requests: { cpu: string; memory: string }
        limits: { cpu: string; memory: string }
      }
      envVars: Record<string, string>
      healthCheck?: {
        enabled: boolean
        httpGet?: { path: string; port: number }
        tcpSocket?: { port: number }
        initialDelaySeconds?: number
        periodSeconds?: number
        timeoutSeconds?: number
        failureThreshold?: number
      }
      readinessProbe?: {
        enabled: boolean
        httpGet?: { path: string; port: number }
        tcpSocket?: { port: number }
        initialDelaySeconds?: number
        periodSeconds?: number
        timeoutSeconds?: number
        failureThreshold?: number
      }
      servicePort: number
      serviceType?: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
      ingressEnabled?: boolean
      ingressHost?: string
      ingressPath?: string
      ingressTls?: boolean
      gitRepository?: string
      gitBranch?: string
      gitPath?: string
    },
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projectTemplates.render.mutate({
        templateId,
        variables,
      })

      toast.success('渲染成功', '模板已生成配置文件')
      return result
    } catch (err) {
      console.error('Failed to render template:', err)
      error.value = '渲染模板失败'

      if (isTRPCClientError(err)) {
        toast.error('渲染模板失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 验证模板配置
   */
  async function validateTemplate(templateId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projectTemplates.validate.query({ templateId })
      return result
    } catch (err) {
      console.error('Failed to validate template:', err)
      error.value = '验证模板失败'

      if (isTRPCClientError(err)) {
        toast.error('验证模板失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建自定义模板（需要管理员权限）
   */
  async function createCustomTemplate(data: RouterInput['projectTemplates']['create']) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projectTemplates.create.mutate(data)

      // 刷新模板列表
      await listTemplates()

      toast.success('创建成功', `模板 "${data.name}" 已创建`)
      return result
    } catch (err) {
      console.error('Failed to create template:', err)
      error.value = '创建模板失败'

      if (isTRPCClientError(err)) {
        toast.error('创建模板失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置分类筛选
   */
  function setCategoryFilter(category: string | undefined) {
    categoryFilter.value = category
  }

  /**
   * 设置搜索关键词
   */
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  /**
   * 切换公开/私有模板显示
   */
  function togglePublicOnly() {
    showPublicOnly.value = !showPublicOnly.value
  }

  /**
   * 清除所有筛选条件
   */
  function clearFilters() {
    categoryFilter.value = undefined
    searchQuery.value = ''
    showPublicOnly.value = true
  }

  /**
   * 获取模板的技术栈标签
   */
  function getTechStackLabel(template: ProjectTemplate): string {
    const { language, framework, runtime } = template.techStack
    const parts = [language, framework, runtime].filter(Boolean)
    return parts.join(' + ')
  }

  /**
   * 获取分类的显示名称
   */
  function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      web: 'Web 应用',
      api: 'API 服务',
      microservice: '微服务',
      static: '静态网站',
      fullstack: '全栈应用',
      mobile: '移动应用',
      data: '数据处理',
    }
    return labels[category] || category
  }

  return {
    // 状态
    templates,
    currentTemplate,
    loading,
    error,

    // 筛选状态
    categoryFilter,
    searchQuery,
    showPublicOnly,

    // 计算属性
    hasTemplates,
    filteredTemplates,
    templatesByCategory,

    // 方法 - 模板管理
    listTemplates,
    getTemplate,
    renderTemplate,
    validateTemplate,
    createCustomTemplate,

    // 方法 - 筛选和搜索
    setCategoryFilter,
    setSearchQuery,
    togglePublicOnly,
    clearFilters,

    // 工具方法
    getTechStackLabel,
    getCategoryLabel,
  }
}
