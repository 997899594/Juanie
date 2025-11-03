<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑项目' : '创建项目' }}</DialogTitle>
        <DialogDescription>
          {{ isEdit ? '更新项目信息和配置' : '创建一个新项目来管理应用和服务' }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- 基本信息 -->
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="name">项目名称</Label>
            <Input
              id="name"
              v-model="formData.name"
              placeholder="例如：我的应用"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="slug">项目标识</Label>
            <Input
              id="slug"
              v-model="formData.slug"
              placeholder="例如：my-app"
              required
              pattern="[a-z0-9-]+"
              @input="handleSlugInput"
            />
            <p class="text-xs text-muted-foreground">
              只能包含小写字母、数字和连字符
            </p>
          </div>

          <div class="space-y-2">
            <Label for="description">描述（可选）</Label>
            <Input
              id="description"
              v-model="formData.description"
              placeholder="项目描述"
            />
          </div>
        </div>

        <!-- 项目配置 -->
        <div class="space-y-4 pt-4 border-t">
          <h4 class="text-sm font-semibold">项目配置</h4>

          <div class="space-y-2">
            <Label for="defaultBranch">默认分支</Label>
            <Input
              id="defaultBranch"
              v-model="formData.config.defaultBranch"
              placeholder="main"
            />
          </div>

          <div class="flex items-center space-x-2">
            <Checkbox
              id="enableCiCd"
              v-model:checked="formData.config.enableCiCd"
            />
            <Label for="enableCiCd" class="cursor-pointer">
              启用 CI/CD 流水线
            </Label>
          </div>

          <div class="flex items-center space-x-2">
            <Checkbox
              id="enableAi"
              v-model:checked="formData.config.enableAi"
            />
            <Label for="enableAi" class="cursor-pointer">
              启用 AI 辅助功能
            </Label>
          </div>
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
import { ref, watch } from 'vue'
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
  Checkbox,
} from '@juanie/ui'
import { Loader2 } from 'lucide-vue-next'

interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  config: {
    defaultBranch?: string
    enableCiCd?: boolean
    enableAi?: boolean
  } | null
}

interface Props {
  open: boolean
  loading?: boolean
  project?: Project | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  project: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [
    data: {
      name: string
      slug: string
      description?: string
      config?: {
        defaultBranch?: string
        enableCiCd?: boolean
        enableAi?: boolean
      }
    }
  ]
}>()

const isEdit = ref(false)
const formData = ref({
  name: '',
  slug: '',
  description: '',
  config: {
    defaultBranch: 'main',
    enableCiCd: true,
    enableAi: false,
  },
})

// 监听 project 变化，用于编辑模式
watch(
  () => props.project,
  (project) => {
    if (project) {
      isEdit.value = true
      formData.value = {
        name: project.name,
        slug: project.slug,
        description: project.description || '',
        config: {
          defaultBranch: project.config?.defaultBranch || 'main',
          enableCiCd: project.config?.enableCiCd ?? true,
          enableAi: project.config?.enableAi ?? false,
        },
      }
    } else {
      isEdit.value = false
      formData.value = {
        name: '',
        slug: '',
        description: '',
        config: {
          defaultBranch: 'main',
          enableCiCd: true,
          enableAi: false,
        },
      }
    }
  },
  { immediate: true }
)

// 监听 open 变化，关闭时重置表单
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen && !props.project) {
      formData.value = {
        name: '',
        slug: '',
        description: '',
        config: {
          defaultBranch: 'main',
          enableCiCd: true,
          enableAi: false,
        },
      }
    }
  }
)

function handleSlugInput(event: Event) {
  const input = event.target as HTMLInputElement
  // 自动转换为小写并替换空格为连字符
  input.value = input.value.toLowerCase().replace(/\s+/g, '-')
  formData.value.slug = input.value
}

function handleSubmit() {
  const data: any = {
    name: formData.value.name,
    slug: formData.value.slug,
  }

  if (formData.value.description) {
    data.description = formData.value.description
  }

  // 只在有配置时添加 config
  if (
    formData.value.config.defaultBranch ||
    formData.value.config.enableCiCd !== undefined ||
    formData.value.config.enableAi !== undefined
  ) {
    data.config = {
      ...(formData.value.config.defaultBranch && {
        defaultBranch: formData.value.config.defaultBranch,
      }),
      enableCiCd: formData.value.config.enableCiCd,
      enableAi: formData.value.config.enableAi,
    }
  }

  emit('submit', data)
}
</script>