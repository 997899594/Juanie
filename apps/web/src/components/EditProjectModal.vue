<template>
  <Dialog :open="true" @update:open="$emit('close')">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>编辑项目</DialogTitle>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div class="space-y-2">
          <Label for="name">项目名称 *</Label>
          <Input
            id="name"
            v-model="form.name"
            type="text"
            placeholder="输入项目名称"
            required
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label for="description">项目描述</Label>
          <Textarea
            id="description"
            v-model="form.description"
            rows="3"
            placeholder="简要描述项目用途和功能"
          />
        </div>

        <div class="space-y-3">
          <Label>项目可见性</Label>
          <div class="space-y-3">
            <div class="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                 :class="{ 'border-primary bg-primary/5': !form.isPublic }"
                 @click="form.isPublic = false">
              <input
                v-model="form.isPublic"
                type="radio"
                :value="false"
                class="mt-1"
              />
              <div class="flex-1">
                <div class="flex items-center text-sm font-medium text-foreground mb-1">
                  <Lock class="w-4 h-4 mr-2" />
                  私有项目
                </div>
                <p class="text-sm text-muted-foreground">只有项目成员可以访问</p>
              </div>
            </div>
            <div class="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                 :class="{ 'border-primary bg-primary/5': form.isPublic }"
                 @click="form.isPublic = true">
              <input
                v-model="form.isPublic"
                type="radio"
                :value="true"
                class="mt-1"
              />
              <div class="flex-1">
                <div class="flex items-center text-sm font-medium text-foreground mb-1">
                  <Globe class="w-4 h-4 mr-2" />
                  公开项目
                </div>
                <p class="text-sm text-muted-foreground">任何人都可以查看项目</p>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="gitlabProjectId">GitLab 项目 ID</Label>
          <Input
            id="gitlabProjectId"
            v-model.number="form.gitlabProjectId"
            type="number"
            placeholder="可选：关联的 GitLab 项目 ID"
          />
          <p class="text-sm text-muted-foreground">关联 GitLab 项目后可以自动同步代码和触发部署</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="$emit('close')">
            取消
          </Button>
          <Button type="submit" :disabled="loading">
            <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
            {{ loading ? '保存中...' : '保存更改' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { trpc } from '@/lib/trpc'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@juanie/ui'
import { Button } from '@juanie/ui'
import { Input } from '@juanie/ui'
import { Textarea } from '@juanie/ui'
import { Label } from '@juanie/ui'
import { Lock, Globe, Loader2 } from 'lucide-vue-next'

interface Project {
  id: number
  name: string
  description?: string
  isPublic: boolean
  gitlabProjectId?: number
}

const props = defineProps<{
  project: Project
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const loading = ref(false)
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: '',
  description: '',
  isPublic: false,
  gitlabProjectId: null as number | null
})

// 初始化表单数据
const initForm = () => {
  form.name = props.project.name
  form.description = props.project.description ?? ''
  form.isPublic = props.project.isPublic
  form.gitlabProjectId = props.project.gitlabProjectId || null
}

// 监听项目变化
watch(() => props.project, initForm, { immediate: true })

const validateForm = () => {
  errors.value = {}
  
  if (!form.name.trim()) {
    errors.value.name = '项目名称不能为空'
    return false
  }
  
  if (form.name.length < 2) {
    errors.value.name = '项目名称至少需要2个字符'
    return false
  }
  
  if (form.name.length > 50) {
    errors.value.name = '项目名称不能超过50个字符'
    return false
  }
  
  return true
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  
  try {
    loading.value = true
    
    const updateData = {
      id: props.project.id,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      isPublic: form.isPublic,
      gitlabProjectId: form.gitlabProjectId || undefined
    }
    
    await trpc.projects.update.mutate(updateData)
    
    // 通知父组件
    emit('updated')
  } catch (error) {
    console.error('更新项目失败:', error)
    
    // 处理特定错误
    if (error.message?.includes('name')) {
      errors.value.name = '项目名称已存在或不符合要求'
    } else {
      // 显示通用错误提示
      alert('更新项目失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}
</script>