<template>
  <demo />
</template>

<script setup lang="ts">
import { demo } from '@juanie/ui'
import { onMounted } from 'vue'

onMounted(() => {
  document.title = 'Juanie - 现代化全栈开发框架'
})
</script>
