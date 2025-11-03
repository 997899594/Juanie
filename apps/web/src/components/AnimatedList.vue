<script setup lang="ts">
import { computed } from 'vue'
import { usePageTransition } from '@/composables/usePageTransition'

interface Props {
  /** 列表项数据 */
  items: any[]
  /** 是否禁用动画（超过50项时自动禁用） */
  disableAnimation?: boolean
  /** 动画延迟基数（ms） */
  baseDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  disableAnimation: false,
  baseDelay: 150,
})

// 超过50项时自动禁用动画以保证性能
const shouldDisableAnimation = computed(() => {
  return props.disableAnimation || props.items.length > 50
})

const animations = usePageTransition({
  disabled: shouldDisableAnimation.value,
  baseDelay: props.baseDelay,
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(item, index) in items"
      :key="item.id || index"
      v-motion
      :initial="animations.listItem(index).initial"
      :enter="animations.listItem(index).enter"
    >
      <slot :item="item" :index="index" />
    </div>
  </div>
</template>
