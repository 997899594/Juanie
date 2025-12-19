import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type RouterInput = inferRouterInputs<AppRouter>
type ProjectTemplate = RouterOutput['projectTemplates']['list'][number]
type TemplateDetail = RouterOutput['projectTemplates']['get']

/**
 * 项目模板管理组合式函数 (TanStack Query)
 */
export function useTemplates() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // 筛选状态
  const categoryFilter = ref<string | undefined>(undefined)
  const searchQuery = ref<string>('')
  const showPublicOnly = ref(true)

  // AI 生成功能状态
  const generatedTemplate = ref<string>('')
  const templateType = ref<'dockerfile' | 'cicd' | ''>('')
  const isGenerating = ref(false)

  // ==================== Queries ====================

  /**
   * 获取所有模板列表
   */
  function useTemplatesQuery(filters?: {
    category?: 'web' | 'api' | 'microservice' | 'static' | 'fullstack' | 'mobile' | 'data'
    isPublic?: boolean
    organizationId?: string
  }) {
    return useQuery({
      queryKey: ['templates', 'list', filters],
      queryFn: async () => {
        try {
          return await trpc.projectTemplates.list.query(filters || {})
        } catch (err) {
          log.error('Failed to fetch templates:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取模板列表失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60 * 10, // 10 分钟 - 模板变化不频繁
    })
  }

  /**
   * 获取模板详情
   */
  function useTemplateQuery(templateId: string) {
    return useQuery({
      queryKey: ['templates', 'detail', templateId],
      queryFn: async () => {
        try {
          return await trpc.projectTemplates.get.query({ templateId })
        } catch (err) {
          log.error('Failed to fetch template:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取模板详情失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60 * 10,
      enabled: !!templateId,
    })
  }

  /**
   * 验证模板配置
   */
  function useValidateTemplateQuery(templateId: string) {
    return useQuery({
      queryKey: ['templates', 'validate', templateId],
      queryFn: async () => {
        try {
          return await trpc.projectTemplates.validate.query({ templateId })
        } catch (err) {
          log.error('Failed to validate template:', err)
          if (isTRPCClientError(err)) {
            toast.error('验证模板失败', err.message)
          }
          throw err
        }
      },
      staleTime: 0,
      enabled: false, // 手动触发
    })
  }

  // ==================== Mutations ====================

  /**
   * 渲染模板
   */
  const renderTemplateMutation = useMutation({
    mutationFn: async ({ templateId, variables }: { templateId: string; variables: any }) => {
      return await trpc.projectTemplates.render.mutate({ templateId, variables })
    },
    onSuccess: () => {
      toast.success('渲染成功', '模板已生成配置文件')
    },
    onError: (err) => {
      log.error('Failed to render template:', err)
      if (isTRPCClientError(err)) {
        toast.error('渲染模板失败', err.message)
      }
    },
  })

  /**
   * 创建自定义模板
   */
  const createCustomTemplateMutation = useMutation({
    mutationFn: async (data: RouterInput['projectTemplates']['create']) => {
      return await trpc.projectTemplates.create.mutate(data)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates', 'list'] })
      toast.success('创建成功', `模板 "${variables.name}" 已创建`)
    },
    onError: (err) => {
      log.error('Failed to create template:', err)
      if (isTRPCClientError(err)) {
        toast.error('创建模板失败', err.message)
      }
    },
  })

  // ==================== 计算属性 ====================

  /**
   * 过滤后的模板列表
   */
  function getFilteredTemplates(templates: ProjectTemplate[]) {
    let result = templates

    if (categoryFilter.value) {
      result = result.filter((t: any) => t.category === categoryFilter.value)
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(
        (t: any) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags?.some((tag: any) => tag.toLowerCase().includes(query)),
      )
    }

    if (showPublicOnly.value) {
      result = result.filter((t: any) => t.isPublic)
    }

    return result
  }

  /**
   * 按分类分组的模板
   */
  function getTemplatesByCategory(templates: ProjectTemplate[]) {
    const grouped: Record<string, ProjectTemplate[]> = {}

    templates.forEach((template) => {
      if (!grouped[template.category]) {
        grouped[template.category] = []
      }
      grouped[template.category]!.push(template)
    })

    return grouped
  }

  // ==================== 筛选方法 ====================

  function setCategoryFilter(category: string | undefined) {
    categoryFilter.value = category
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function togglePublicOnly() {
    showPublicOnly.value = !showPublicOnly.value
  }

  function clearFilters() {
    categoryFilter.value = undefined
    searchQuery.value = ''
    showPublicOnly.value = true
  }

  // ==================== 工具方法 ====================

  function getTechStackLabel(template: ProjectTemplate): string {
    const { language, framework, runtime } = template.techStack
    const parts = [language, framework, runtime].filter(Boolean)
    return parts.join(' + ')
  }

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

  // ==================== AI 生成功能 ====================

  const generateDockerfile = async (config: any) => {
    isGenerating.value = true
    templateType.value = 'dockerfile'
    try {
      // TODO: 调用 AI 服务生成 Dockerfile
      await new Promise((resolve) => setTimeout(resolve, 1000))
      generatedTemplate.value = `# Generated Dockerfile\nFROM node:${config.version}\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]`
      toast.success('Dockerfile 生成成功')
    } catch (_err) {
      toast.error('生成 Dockerfile 失败')
    } finally {
      isGenerating.value = false
    }
  }

  const generateCICD = async (_config: any) => {
    isGenerating.value = true
    templateType.value = 'cicd'
    try {
      // TODO: 调用 AI 服务生成 CI/CD 配置
      await new Promise((resolve) => setTimeout(resolve, 1000))
      generatedTemplate.value = `# Generated CI/CD Config\nstages:\n  - build\n  - test\n  - deploy\n\nbuild:\n  stage: build\n  script:\n    - npm install\n    - npm run build`
      toast.success('CI/CD 配置生成成功')
    } catch (_err) {
      toast.error('生成 CI/CD 配置失败')
    } finally {
      isGenerating.value = false
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedTemplate.value)
      toast.success('已复制到剪贴板')
    } catch (_err) {
      toast.error('复制失败')
    }
  }

  const downloadTemplate = (filename: string) => {
    const blob = new Blob([generatedTemplate.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('下载成功')
  }

  return {
    // Queries
    useTemplatesQuery,
    useTemplateQuery,
    useValidateTemplateQuery,

    // Mutations
    renderTemplate: renderTemplateMutation.mutateAsync,
    renderTemplateMutation,
    createCustomTemplate: createCustomTemplateMutation.mutateAsync,
    createCustomTemplateMutation,

    // 筛选状态
    categoryFilter,
    searchQuery,
    showPublicOnly,

    // 筛选方法
    setCategoryFilter,
    setSearchQuery,
    togglePublicOnly,
    clearFilters,

    // 工具方法
    getTechStackLabel,
    getCategoryLabel,
    getFilteredTemplates,
    getTemplatesByCategory,

    // AI 生成功能
    generatedTemplate,
    templateType,
    isGenerating,
    generateDockerfile,
    generateCICD,
    copyToClipboard,
    downloadTemplate,
  }
}
