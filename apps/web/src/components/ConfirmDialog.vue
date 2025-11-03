<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@juanie/ui'
import { AlertTriangle } from 'lucide-vue-next'

interface Props {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认操作',
  description: '您确定要执行此操作吗？',
  confirmLabel: '确认',
  cancelLabel: '取消',
  variant: 'default',
  loading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('update:open', false)
}

const handleOpenChange = (value: boolean) => {
  emit('update:open', value)
  if (!value) {
    emit('cancel')
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent>
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div
            v-if="variant === 'destructive'"
            class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10"
          >
            <AlertTriangle class="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle>{{ title }}</DialogTitle>
        </div>
        <DialogDescription>
          {{ description }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          @click="handleCancel"
          :disabled="loading"
        >
          {{ cancelLabel }}
        </Button>
        <Button
          :variant="variant"
          @click="handleConfirm"
          :disabled="loading"
        >
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
