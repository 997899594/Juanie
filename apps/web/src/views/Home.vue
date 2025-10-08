<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="container mx-auto px-4 py-16">
      <div class="text-center space-y-8">
        <div class="space-y-4">
          <h1 class="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Juanie
          </h1>
          <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
            现代化的 Vue3 + TypeScript 全栈开发框架
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <!-- 主题系统 -->
          <router-link 
            to="/theme-demo"
            class="group bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <div class="space-y-4">
              <div class="text-4xl">🎨</div>
              <h3 class="text-xl font-semibold">主题系统</h3>
              <p class="text-muted-foreground text-sm">
                完整的多主题系统，支持明暗模式切换、自定义主题、导入导出等功能
              </p>
              <div class="flex items-center text-primary text-sm font-medium group-hover:translate-x-1 transition-transform">
                查看演示 →
              </div>
            </div>
          </router-link>

          <!-- API 系统 -->
          <div class="bg-card border border-border rounded-lg p-6 opacity-50">
            <div class="space-y-4">
              <div class="text-4xl">🚀</div>
              <h3 class="text-xl font-semibold">API 系统</h3>
              <p class="text-muted-foreground text-sm">
                基于 Nitro + tRPC 的现代化 API 系统
              </p>
              <div class="text-muted-foreground text-sm">
                即将推出...
              </div>
            </div>
          </div>

          <!-- 组件库 -->
          <div class="bg-card border border-border rounded-lg p-6 opacity-50">
            <div class="space-y-4">
              <div class="text-4xl">🧩</div>
              <h3 class="text-xl font-semibold">组件库</h3>
              <p class="text-muted-foreground text-sm">
                基于 shadcn-vue 的现代化组件库
              </p>
              <div class="text-muted-foreground text-sm">
                即将推出...
              </div>
            </div>
          </div>
        </div>

        <!-- 快速开始 -->
        <div class="space-y-4">
          <h2 class="text-2xl font-semibold">快速开始</h2>
          <div class="bg-muted p-4 rounded-lg max-w-2xl mx-auto">
            <code class="text-sm">
              git clone https://github.com/your-username/juanie.git<br>
              cd juanie<br>
              bun install<br>
              bun run dev
            </code>
          </div>
        </div>

        <!-- 技术栈 -->
        <div class="space-y-4">
          <h2 class="text-2xl font-semibold">技术栈</h2>
          <div class="flex flex-wrap justify-center gap-2">
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">Vue 3</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">TypeScript</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">Vite</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">Tailwind CSS v4</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">shadcn-vue</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">Nitro</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">tRPC</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">Drizzle ORM</span>
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">Bun</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  document.title = 'Juanie - 现代化全栈开发框架'
})
</script>
