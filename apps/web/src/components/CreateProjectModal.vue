<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">创建新项目</h3>
        <button @click="$emit('close')" class="close-btn">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label for="name" class="form-label">项目名称 *</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            class="form-input"
            placeholder="输入项目名称"
            required
          />
          <p v-if="errors.name" class="form-error">{{ errors.name }}</p>
        </div>

        <div class="form-group">
          <label for="displayName" class="form-label">显示名称</label>
          <input
            id="displayName"
            v-model="form.displayName"
            type="text"
            class="form-input"
            placeholder="输入项目显示名称（可选）"
          />
        </div>

        <div class="form-group">
          <label for="logo" class="form-label">项目Logo</label>
          <input
            id="logo"
            v-model="form.logo"
            type="url"
            class="form-input"
            placeholder="输入Logo URL（可选）"
          />
        </div>

        <div class="form-group">
          <label for="description" class="form-label">项目描述</label>
          <textarea
            id="description"
            v-model="form.description"
            class="form-textarea"
            rows="3"
            placeholder="简要描述项目用途和功能"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">项目可见性</label>
          <div class="radio-group">
            <label class="radio-item">
              <input
                v-model="form.isPublic"
                type="radio"
                :value="false"
                class="radio-input"
              />
              <div class="radio-content">
                <div class="radio-title">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  私有项目
                </div>
                <p class="radio-description">只有项目成员可以访问</p>
              </div>
            </label>
            <label class="radio-item">
              <input
                v-model="form.isPublic"
                type="radio"
                :value="true"
                class="radio-input"
              />
              <div class="radio-content">
                <div class="radio-title">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  公开项目
                </div>
                <p class="radio-description">任何人都可以查看项目</p>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="gitlabProjectId" class="form-label">GitLab 项目 ID</label>
          <input
            id="gitlabProjectId"
            v-model.number="form.gitlabProjectId"
            type="number"
            class="form-input"
            placeholder="可选：关联的 GitLab 项目 ID"
          />
          <p class="form-help">关联 GitLab 项目后可以自动同步代码和触发部署</p>
        </div>

        <div class="modal-footer">
          <button type="button" @click="$emit('close')" class="btn btn-secondary">
            取消
          </button>
          <button type="submit" :disabled="loading" class="btn btn-primary">
            <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? '创建中...' : '创建项目' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { trpc, type AppRouter } from '@/lib/trpc'

const emit = defineEmits<{
  close: []
  created: []
}>()

const loading = ref(false)
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: '',
  displayName: '',
  description: '',
  logo: '',
  isPublic: false,
  gitlabProjectId: null as number | null
})

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
    
    const projectData = {
      name: form.name.trim(),
      displayName: form.displayName.trim() || '',
      description: form.description.trim() || '',
      logo: form.logo.trim() || '',
      isPublic: form.isPublic,
      gitlabProjectId: form.gitlabProjectId || undefined
    }
    
    await trpc.projects.create.mutate(projectData)
    
    // 重置表单
    form.name = ''
    form.displayName = ''
    form.description = ''
    form.logo = ''
    form.isPublic = false
    form.gitlabProjectId = null
    
    // 通知父组件
    emit('created')
  } catch (error: any) {
    console.error('创建项目失败:', error)
    
    // 处理特定错误
    if (error?.message?.includes('name')) {
      errors.value.name = '项目名称已存在或不符合要求'
    } else {
      // 显示通用错误提示
      alert('创建项目失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* 移除所有@apply，使用UI库的原生类名和组件 */
</style>