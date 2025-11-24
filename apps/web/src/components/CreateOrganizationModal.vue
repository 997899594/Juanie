<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑组织' : '创建组织' }}</DialogTitle>
        <DialogDescription>
          {{ isEdit ? '更新组织信息' : '创建一个新的组织来管理团队和项目' }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="name">组织名称</Label>
          <Input
            id="name"
            v-model="formData.name"
            placeholder="例如：我的公司"
            required
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="$emit('update:open', false)"
          >
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
} from '@juanie/ui'
import { Loader2 } from 'lucide-vue-next'

interface Organization {
  id: string
  name: string
  slug: string
  displayName: string | null
}

interface Props {
  open: boolean
  loading?: boolean
  organization?: Organization | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  organization: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [data: { name: string; slug: string; displayName?: string }]
}>()

const isEdit = ref(false)
const formData = ref({
  name: '',
  slug: '',
})

// 监听 organization 变化，用于编辑模式
watch(
  () => props.organization,
  (org) => {
    if (org) {
      isEdit.value = true
      formData.value = {
        name: org.name,
        slug: org.slug,
      }
    } else {
      isEdit.value = false
      formData.value = {
        name: '',
        slug: '',
      }
    }
  },
  { immediate: true }
)

// 监听 open 变化，关闭时重置表单
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen && !props.organization) {
      formData.value = {
        name: '',
        slug: '',
      }
    }
  }
)

function handleSubmit() {
  const data = {
    name: formData.value.name,
    slug: formData.value.name.toLowerCase().replace(/\s+/g, '-'),
  }
  emit('submit', data)
}
</script>
