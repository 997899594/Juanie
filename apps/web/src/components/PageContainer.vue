<script setup lang="ts">
import { usePageTransition } from '@/composables/usePageTransition'

interface Props {
  /** 是否禁用动画 */
  disableAnimation?: boolean
  /** 页面标题 */
  title?: string
  /** 页面描述 */
  description?: string
}

const props = defineProps<Props>()

const animations = usePageTransition({
  disabled: props.disableAnimation,
})
</script>

<template>
  <div
    v-motion
    :initial="animations.page.initial"
    :enter="animations.page.enter"
    class="container mx-auto p-6 space-y-6"
  >
    <!-- 页面标题区域 -->
    <div
      v-if="title || $slots.header"
      v-motion
      :initial="animations.header.initial"
      :enter="animations.header.enter"
      class="flex items-center justify-between"
    >
      <slot name="header">
        <div v-if="title">
          <h1 class="text-3xl font-bold tracking-tight">{{ title }}</h1>
          <p v-if="description" class="text-muted-foreground mt-2">
            {{ description }}
          </p>
        </div>
      </slot>
      <slot name="actions" />
    </div>

    <!-- 页面内容 -->
    <slot />
  </div>
</template>
