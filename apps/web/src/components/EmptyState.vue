<script setup lang="ts">
import { Button } from '@juanie/ui'
import type { Component } from 'vue'

interface Props {
  icon?: Component
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: Component
}

const props = defineProps<Props>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <component
      v-if="icon"
      :is="icon"
      class="h-16 w-16 text-muted-foreground mb-4"
    />
    <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground max-w-md mb-6">
      {{ description }}
    </p>
    <Button v-if="actionLabel" @click="emit('action')">
      <component v-if="actionIcon" :is="actionIcon" class="mr-2 h-4 w-4" />
      {{ actionLabel }}
    </Button>
  </div>
</template>
