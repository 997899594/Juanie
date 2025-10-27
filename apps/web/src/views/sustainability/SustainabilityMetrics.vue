<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">可持续性指标</h1>
        <p class="text-muted-foreground">
          碳足迹监控和绿色 DevOps 实践
        </p>
      </div>
      <Button>
        <BarChart3 class="mr-2 h-4 w-4" />
        生成报告
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>可持续性指标功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <Leaf class="h-16 w-16 mx-auto mb-4" />
            <p>可持续性指标功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Leaf, BarChart3 } from 'lucide-vue-next'
</script>