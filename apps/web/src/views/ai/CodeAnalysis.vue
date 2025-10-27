<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">代码分析</h1>
        <p class="text-muted-foreground">
          AI 驱动的代码质量分析和安全漏洞检测
        </p>
      </div>
      <Button>
        <Play class="mr-2 h-4 w-4" />
        开始扫描
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>代码分析功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <Code class="h-16 w-16 mx-auto mb-4" />
            <p>AI 代码分析功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Code, Play } from 'lucide-vue-next'
</script>