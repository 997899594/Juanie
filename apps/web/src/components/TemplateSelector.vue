<template>
  <div class="space-y-6">
    <!-- 模板选择下拉框 -->
    <div class="space-y-2">
      <Label for="template-select">项目模板</Label>
      <Select v-model="selectedTemplateId" @update:model-value="handleTemplateChange">
        <SelectTrigger id="template-select">
          <SelectValue placeholder="选择模板或空白项目" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="blank">
            <div class="flex items-center gap-2">
              <FileQuestion class="h-4 w-4" />
              <span>空白项目 - 自定义配置</span>
            </div>
          </SelectItem>
          <SelectItem
            v-for="template in templates"
            :key="template.id"
            :value="template.id"
          >
            <div class="flex items-center gap-2">
              <component :is="getTemplateIcon(template.category)" class="h-4 w-4" />
              <span>{{ template.name }} - {{ template.techStack?.framework || template.category }}</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p class="text-xs text-muted-foreground">
        选择一个预设模板快速开始，或从空白项目自定义配置
      </p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- 选中模板的详情 -->
    <Card v-else-if="selectedTemplate" class="border-2">
      <CardHeader>
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <component
              :is="getTemplateIcon(selectedTemplate.category)"
              class="h-8 w-8 text-primary"
            />
          </div>
          <div class="flex-1">
            <CardTitle>{{ selectedTemplate.name }}</CardTitle>
            <CardDescription class="mt-1">
              {{ selectedTemplate.description }}
            </CardDescription>
            <div class="flex flex-wrap gap-1.5 mt-3">
              <Badge
                v-for="tech in getTechStack(selectedTemplate)"
                :key="tech"
                variant="secondary"
              >
                {{ tech }}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent class="space-y-4">
        <div v-if="selectedTemplate.defaultConfig" class="grid md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">环境配置</div>
            <div class="text-sm text-muted-foreground">
              {{ selectedTemplate.defaultConfig.environments?.length || 0 }} 个环境 (Development, Staging, Production)
            </div>
          </div>
          
          <div v-if="selectedTemplate.defaultConfig.resources" class="space-y-2">
            <div class="text-sm font-medium">默认资源</div>
            <div class="text-sm text-muted-foreground font-mono">
              CPU: {{ selectedTemplate.defaultConfig.resources.requests?.cpu || 'N/A' }} / 
              内存: {{ selectedTemplate.defaultConfig.resources.requests?.memory || 'N/A' }}
            </div>
          </div>
          
          <div v-if="selectedTemplate.defaultConfig.healthCheck" class="space-y-2">
            <div class="text-sm font-medium">健康检查</div>
            <div class="text-sm text-muted-foreground">
              {{ selectedTemplate.defaultConfig.healthCheck.path }} (每 {{ selectedTemplate.defaultConfig.healthCheck.periodSeconds }}s)
            </div>
          </div>
          
          <div v-if="selectedTemplate.defaultConfig.gitops" class="space-y-2">
            <div class="text-sm font-medium">GitOps</div>
            <div class="text-sm text-muted-foreground">
              {{ selectedTemplate.defaultConfig.gitops.enabled ? '已启用' : '未启用' }} - 
              同步间隔: {{ selectedTemplate.defaultConfig.gitops.syncInterval }}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    
    <!-- 空白项目提示 -->
    <Card v-else-if="selectedTemplateId === 'blank'" class="border-2 border-dashed">
      <CardContent class="py-8 text-center">
        <FileQuestion class="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h4 class="font-semibold mb-1">空白项目</h4>
        <p class="text-sm text-muted-foreground">
          将创建基础的 3 个环境，您可以在创建后自定义所有配置
        </p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@juanie/ui'
import {
  Loader2,
  FileQuestion,
  Zap,
  Server,
  Layers,
  Network,
  Globe,
  Code,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

const modelValue = defineModel<string | null>()

const emit = defineEmits<{
  'template-selected': [template: any]
}>()

const toast = useToast()

// 状态
const templates = ref<any[]>([])
const loading = ref(false)
const selectedTemplateId = ref<string>(modelValue.value || 'blank') // 默认选择空白模板


// 计算属性
const selectedTemplate = computed(() => {
  if (!selectedTemplateId.value || selectedTemplateId.value === 'blank') {
    return null
  }
  return templates.value.find(t => t.id === selectedTemplateId.value)
})

// 获取模板图标
function getTemplateIcon(category: string) {
  const icons: Record<string, any> = {
    web: Zap,
    api: Server,
    microservice: Network,
    static: Globe,
    fullstack: Layers,
  }
  return icons[category] || Code
}

// 获取技术栈
function getTechStack(template: any): string[] {
  if (!template.techStack) return []
  return [
    template.techStack.language,
    template.techStack.framework,
    template.techStack.runtime,
  ].filter(Boolean)
}

// 处理模板变化
function handleTemplateChange(value: any) {
  if (!value || typeof value !== 'string') return
  
  selectedTemplateId.value = value
  
  if (value === 'blank') {
    modelValue.value = null
    emit('template-selected', null)
  } else {
    const template = templates.value.find(t => t.id === value)
    if (template) {
      modelValue.value = template.id
      emit('template-selected', template)
    }
  }
}



// 加载模板列表
async function loadTemplates() {
  loading.value = true
  try {
    // ✅ 修复：使用正确的 API 路径 templates.list（而不是 projectTemplates.list）
    const result = await trpc.templates.list.query({})
    templates.value = result
  } catch (error: any) {
    toast.error('加载模板失败', error.message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTemplates()
})
</script>
