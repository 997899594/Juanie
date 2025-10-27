<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">团队管理</h1>
        <p class="text-muted-foreground">
          团队成员管理和协作配置
        </p>
      </div>
      <Button>
        <Plus class="mr-2 h-4 w-4" />
        邀请成员
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>团队管理功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <Users class="h-16 w-16 mx-auto mb-4" />
            <p>团队管理功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Users, Plus } from 'lucide-vue-next'
</script>