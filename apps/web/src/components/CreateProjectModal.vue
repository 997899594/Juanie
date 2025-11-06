<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑项目' : '创建项目' }}</DialogTitle>
        <DialogDescription>
          {{ isEdit ? '更新项目信息' : '填写项目信息以创建新项目' }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="name">项目名称 *</Label>
          <Input
            id="name"
            v-model="form.name"
            placeholder="例如：web-dashboard"
            :class="{ 'border-destructive': errors.name }"
            required
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label for="slug">项目标识（slug） *</Label>
          <Input
            id="slug"
            v-model="form.slug"
            placeholder="例如：web-dashboard"
            pattern="^[a-z0-9\-]+$"
            @input="handleSlugInput"
            required
          />
          <p class="text-xs text-muted-foreground">
            只能包含小写字母、数字和连字符，长度 3-50。
          </p>
          <p v-if="errors.slug" class="text-sm text-destructive">{{ errors.slug }}</p>
        </div>

        <div class="space-y-2">
          <Label for="displayName">显示名称</Label>
          <Input
            id="displayName"
            v-model="form.displayName"
            placeholder="例如：Juanie Web 控制台"
          />
        </div>

        <div class="space-y-2">
          <Label for="description">项目描述</Label>
          <Textarea
            id="description"
            v-model="form.description"
            placeholder="项目的用途与简介（可选）"
            rows="3"
          />
        </div>

        <div class="space-y-2">
          <Label for="visibility">可见性</Label>
          <Select v-model="form.visibility">
            <SelectTrigger>
              <SelectValue placeholder="选择可见性" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">私有</SelectItem>
              <SelectItem value="internal">内部</SelectItem>
              <SelectItem value="public">公开</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="repositoryUrl">代码仓库 URL</Label>
          <Input
            id="repositoryUrl"
            v-model="form.repositoryUrl"
            type="url"
            placeholder="https://github.com/username/repo"
          />
          <p class="text-xs text-muted-foreground">用于自动化部署与集成</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="$emit('update:open', false)">
            取消
          </Button>
          <Button type="submit" :disabled="loading">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            {{ isEdit ? '更新' : '创建' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
} from '@juanie/ui'
import { Loader2 } from 'lucide-vue-next'

interface ProjectLike {
  id?: string
  name?: string
  displayName?: string | null
  description?: string | null
  repositoryUrl?: string | null
  visibility?: 'public' | 'private' | 'internal'
}

const props = withDefaults(defineProps<{
  open: boolean
  loading?: boolean
  project?: ProjectLike | null
}>(), {
  loading: false,
  project: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [data: { name: string; displayName?: string; description?: string; repositoryUrl?: string; visibility: 'public' | 'private' | 'internal' }]
}>()

const errors = ref<Record<string, string>>({})
const isEdit = computed(() => !!props.project)

const form = reactive({
  name: '',
  slug: '',
  displayName: '',
  description: '',
  repositoryUrl: '',
  visibility: 'private' as 'public' | 'private' | 'internal',
})

watch(() => props.project, (p) => {
  if (p) {
    form.name = p.name || ''
    // 编辑模式下 slug 仅在存在时显示，避免强制修改
    form.slug = (p.name || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    form.displayName = p.displayName || ''
    form.description = p.description || ''
    form.repositoryUrl = p.repositoryUrl || ''
    form.visibility = p.visibility || 'private'
  } else {
    form.name = ''
    form.slug = ''
    form.displayName = ''
    form.description = ''
    form.repositoryUrl = ''
    form.visibility = 'private'
  }
}, { immediate: true })

watch(() => props.open, (isOpen) => {
  if (!isOpen && !props.project) {
    form.name = ''
    form.slug = ''
    form.displayName = ''
    form.description = ''
    form.repositoryUrl = ''
    form.visibility = 'private'
    errors.value = {}
  }
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
  const slug = form.slug.trim()
  if (!slug) {
    errors.value.slug = '项目标识（slug）不能为空'
    return false
  }
  if (slug.length < 3 || slug.length > 50) {
    errors.value.slug = 'slug 长度需在 3-50 之间'
    return false
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.value.slug = 'slug 只能包含小写字母、数字和连字符'
    return false
  }
  return true
}

function handleSubmit() {
  if (!validateForm()) return
  emit('submit', {
    name: form.name.trim(),
    slug: form.slug.trim(),
    ...(form.displayName && { displayName: form.displayName.trim() }),
    ...(form.description && { description: form.description.trim() }),
    ...(form.repositoryUrl && { repositoryUrl: form.repositoryUrl.trim() }),
    visibility: form.visibility,
  })
}

function handleSlugInput() {
  form.slug = form.slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// 根据名称自动生成 slug（仅在 slug 为空时）
watch(() => form.name, (newName) => {
  if (!form.slug) {
    const auto = String(newName || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    form.slug = auto
  }
})
</script>

<style scoped>
/* 统一使用 UI 库组件与类名 */
</style>