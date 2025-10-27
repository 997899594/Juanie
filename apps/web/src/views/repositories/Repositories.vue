<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">代码仓库</h1>
        <p class="text-muted-foreground">
          Git 仓库集成和代码管理
        </p>
      </div>
      <Button>
        <Plus class="mr-2 h-4 w-4" />
        连接仓库
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>代码仓库管理功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <GitBranch class="h-16 w-16 mx-auto mb-4" />
            <p>代码仓库管理功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { GitBranch, Plus } from 'lucide-vue-next'
</script>