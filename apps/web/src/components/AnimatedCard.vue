<script setup lang="ts">
import { Card } from '@juanie/ui'
import { usePageTransition, cardHoverClass } from '@/composables/usePageTransition'

interface Props {
  /** 卡片索引（用于交错动画） */
  index?: number
  /** 是否禁用动画 */
  disableAnimation?: boolean
  /** 是否禁用悬停效果 */
  disableHover?: boolean
  /** 动画类型 */
  animationType?: 'card' | 'stats'
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  disableAnimation: false,
  disableHover: false,
  animationType: 'card',
})

const animations = usePageTransition({
  disabled: props.disableAnimation,
})

const animationConfig = props.animationType === 'stats' 
  ? animations.statsCard(props.index)
  : animations.card(props.index)

const hoverClass = props.disableHover ? '' : cardHoverClass
</script>

<template>
  <Card
    v-motion
    :initial="animationConfig.initial"
    :enter="animationConfig.enter"
    :class="hoverClass"
  >
    <slot />
  </Card>
</template>
