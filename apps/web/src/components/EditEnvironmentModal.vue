<template>
  <Dialog :open="true" @update:open="$emit('close')">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>编辑环境</DialogTitle>
        <DialogDescription>
          修改环境配置信息
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- 环境名称 -->
        <div class="form-field">
          <Label for="name">环境名称 *</Label>
          <Input
            id="name"
            v-model="form.name"
            placeholder="例如：production, staging, development"
            :class="{ 'border-destructive': errors.name }"
          />
          <p v-if="errors.name" class="text-sm text-destructive mt-1">
            {{ errors.name }}
          </p>
        </div>

        <!-- 环境描述 -->
        <div class="form-field">
          <Label for="description">环境描述</Label>
          <Textarea
            id="description"
            v-model="form.description"
            placeholder="描述这个环境的用途..."
            rows="3"
          />
        </div>

        <!-- 环境类型 -->
        <div class="form-field">
          <Label for="type">环境类型 *</Label>
          <Select v-model="form.type">
            <SelectTrigger>
              <SelectValue placeholder="选择环境类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">开发环境</SelectItem>
              <SelectItem value="staging">预发布环境</SelectItem>
              <SelectItem value="production">生产环境</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.type" class="text-sm text-destructive mt-1">
            {{ errors.type }}
          </p>
        </div>

        <!-- 环境 URL -->
        <div class="form-field">
          <Label for="url">环境 URL</Label>
          <Input
            id="url"
            v-model="form.url"
            placeholder="https://example.com"
            type="url"
            :class="{ 'border-destructive': errors.url }"
          />
          <p v-if="errors.url" class="text-sm text-destructive mt-1">
            {{ errors.url }}
          </p>
        </div>

        <!-- 环境状态 -->
        <div class="form-field">
          <Label for="status">环境状态</Label>
          <Select v-model="form.status">
            <SelectTrigger>
              <SelectValue placeholder="选择环境状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">活跃</SelectItem>
              <SelectItem value="inactive">停用</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 环境变量 -->
        <div class="form-field">
          <Label>环境变量</Label>
          <div class="space-y-2">
            <div 
              v-for="(variable, index) in form.variables" 
              :key="index"
              class="flex items-center space-x-2"
            >
              <Input
                v-model="variable.key"
                placeholder="变量名"
                class="flex-1"
              />
              <Input
                v-model="variable.value"
                placeholder="变量值"
                class="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                @click="removeVariable(index)"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="addVariable"
              class="w-full"
            >
              <Plus class="h-4 w-4 mr-2" />
              添加环境变量
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="$emit('close')"
            :disabled="loading"
          >
            取消
          </Button>
          <Button type="submit" :disabled="loading">
            <Loader2 v-if="loading" class="h-4 w-4 mr-2 animate-spin" />
            保存更改
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@juanie/ui'
import { Plus, X, Loader2 } from 'lucide-vue-next'
import { trpc, type AppRouter } from '@/lib/trpc'

interface EnvironmentVariable {
  key: string
  value: string
}

type Environment = Awaited<ReturnType<typeof trpc.environments.getById.query>>

const props = defineProps<{
  environment: Environment
}>()

const emit = defineEmits<{
  close: []
  updated: [environment: Environment]
}>()

const loading = ref(false)
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: '',
  description: '',
  type: '' as 'development' | 'staging' | 'production' | '',
  status: '' as 'active' | 'inactive' | '',
  url: '',
  variables: [] as EnvironmentVariable[]
})

// 初始化表单数据
const initForm = () => {
  form.name = props.environment.name
  form.description = props.environment.displayName || ''
  form.type = 'development' // 默认类型，因为 environment schema 中没有 type 字段
  form.status = props.environment.isActive 
    ? 'active' 
    : 'inactive'
  form.url = props.environment.url || ''
  // 从 config.environmentVariables 获取环境变量
  const envVars = props.environment.config?.environmentVariables || {}
  form.variables = Object.entries(envVars).map(([key, value]) => ({ key, value: String(value) }))
}

// 监听环境变化
watch(() => props.environment, initForm, { immediate: true })

// 添加环境变量
const addVariable = () => {
  form.variables.push({ key: '', value: '' })
}

// 移除环境变量
const removeVariable = (index: number) => {
  form.variables.splice(index, 1)
}

// 表单验证
const validateForm = () => {
  errors.value = {}
  
  if (!form.name.trim()) {
    errors.value.name = '环境名称不能为空'
    return false
  }
  
  if (form.name.length < 2) {
    errors.value.name = '环境名称至少需要2个字符'
    return false
  }
  
  if (form.name.length > 50) {
    errors.value.name = '环境名称不能超过50个字符'
    return false
  }
  
  // 验证环境名称格式（只允许字母、数字、连字符和下划线）
  if (!/^[a-zA-Z0-9_-]+$/.test(form.name)) {
    errors.value.name = '环境名称只能包含字母、数字、连字符和下划线'
    return false
  }
  
  if (!form.type) {
    errors.value.type = '请选择环境类型'
    return false
  }
  
  if (form.url && !isValidUrl(form.url)) {
    errors.value.url = '请输入有效的 URL'
    return false
  }
  
  return true
}

// 验证 URL 格式
const isValidUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  
  try {
    loading.value = true
    
    // 过滤空的环境变量并转换为 config.environmentVariables 格式
    const variables = form.variables.filter(v => v.key.trim() && v.value.trim())
    const environmentVariables = variables.reduce((acc, v) => {
      acc[v.key] = v.value
      return acc
    }, {} as Record<string, string>)
    
    const updateData = {
      id: props.environment.id,
      displayName: form.description.trim() || form.name.trim(),
      url: form.url.trim() || undefined,
      branch: undefined,
      isActive: form.status === 'active',
      config: Object.keys(environmentVariables).length > 0 ? {
        environmentVariables
      } : undefined
    }
    
    const result = await trpc.environments.update.mutate(updateData)
    
    if (result) {
      emit('updated', result)
    }
  } catch (error: any) {
    console.error('更新环境失败:', error)
    
    // 处理服务器验证错误
    if (error?.data?.zodError) {
      const zodErrors = error.data.zodError.fieldErrors
      Object.keys(zodErrors).forEach(field => {
        errors.value[field] = zodErrors[field][0]
      })
    } else if (error?.message) {
      errors.value.general = error.message
    } else {
      errors.value.general = '更新环境失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* 移除所有@apply，使用UI库的原生类名和组件 */
</style>