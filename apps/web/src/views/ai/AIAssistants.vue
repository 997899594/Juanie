<template>
  <div class="space-y-6">
    <!-- 页面头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">AI 助手</h1>
        <p class="text-muted-foreground">
          智能化 DevOps 助手，提供代码审查、安全分析、成本优化等专业服务
        </p>
      </div>
      <Button>
        <Plus class="mr-2 h-4 w-4" />
        创建助手
      </Button>
    </div>

    <!-- 助手类型卡片 -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="assistant in assistantTypes" :key="assistant.type" class="relative overflow-hidden">
        <CardHeader class="pb-3">
          <div class="flex items-center space-x-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <component :is="assistant.icon" class="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle class="text-lg">{{ assistant.name }}</CardTitle>
              <Badge :variant="assistant.status === 'active' ? 'default' : 'secondary'">
                {{ assistant.status === 'active' ? '活跃' : '待激活' }}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground mb-4">{{ assistant.description }}</p>
          <div class="space-y-2">
            <div class="flex items-center text-xs text-muted-foreground">
              <Clock class="mr-1 h-3 w-3" />
              最后活动: {{ assistant.lastActive }}
            </div>
            <div class="flex items-center text-xs text-muted-foreground">
              <TrendingUp class="mr-1 h-3 w-3" />
              处理任务: {{ assistant.tasksCompleted }}
            </div>
          </div>
        </CardContent>
        <CardFooter class="pt-0">
          <Button 
            :variant="assistant.status === 'active' ? 'outline' : 'default'" 
            class="w-full"
            @click="toggleAssistant(assistant)"
          >
            {{ assistant.status === 'active' ? '配置' : '激活' }}
          </Button>
        </CardFooter>
      </Card>
    </div>

    <!-- 最近活动 -->
    <Card>
      <CardHeader>
        <CardTitle>最近活动</CardTitle>
        <CardDescription>AI 助手的最新工作记录</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div v-for="activity in recentActivities" :key="activity.id" class="flex items-start space-x-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <component :is="activity.icon" class="h-4 w-4 text-primary" />
            </div>
            <div class="flex-1 space-y-1">
              <p class="text-sm font-medium">{{ activity.title }}</p>
              <p class="text-xs text-muted-foreground">{{ activity.description }}</p>
              <p class="text-xs text-muted-foreground">{{ activity.timestamp }}</p>
            </div>
            <Badge :variant="activity.type === 'success' ? 'default' : 'secondary'">
              {{ activity.type === 'success' ? '成功' : '进行中' }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@juanie/ui'
import { 
  Bot, Code, Shield, DollarSign, AlertCircle, 
  Plus, Clock, TrendingUp, CheckCircle, GitBranch 
} from 'lucide-vue-next'

// AI 助手类型定义
const assistantTypes = ref([
  {
    type: 'code-reviewer',
    name: '代码审查员',
    description: '智能代码审查，检测潜在问题，提供优化建议，确保代码质量和最佳实践',
    icon: Code,
    status: 'active',
    lastActive: '2分钟前',
    tasksCompleted: 156
  },
  {
    type: 'devops-engineer',
    name: 'DevOps 工程师',
    description: '自动化部署流程，优化 CI/CD 管道，监控系统性能，提供运维建议',
    icon: GitBranch,
    status: 'active',
    lastActive: '5分钟前',
    tasksCompleted: 89
  },
  {
    type: 'security-analyst',
    name: '安全分析师',
    description: '实时安全威胁检测，漏洞扫描分析，合规性检查，安全策略推荐',
    icon: Shield,
    status: 'inactive',
    lastActive: '1小时前',
    tasksCompleted: 34
  },
  {
    type: 'cost-optimizer',
    name: '成本优化师',
    description: '资源使用分析，成本预测建议，云服务优化，可持续性评估',
    icon: DollarSign,
    status: 'inactive',
    lastActive: '3小时前',
    tasksCompleted: 23
  },
  {
    type: 'incident-responder',
    name: '事件响应专家',
    description: '智能事件分类，自动化响应流程，根因分析，故障预防建议',
    icon: AlertCircle,
    status: 'active',
    lastActive: '10分钟前',
    tasksCompleted: 67
  },
  {
    type: 'ai-architect',
    name: 'AI 架构师',
    description: '系统架构分析，技术栈优化建议，性能瓶颈识别，扩展性评估',
    icon: Bot,
    status: 'inactive',
    lastActive: '6小时前',
    tasksCompleted: 12
  }
])

// 最近活动
const recentActivities = ref([
  {
    id: 1,
    title: '代码审查完成',
    description: '对 user-service 模块进行了全面审查，发现 3 个潜在问题',
    timestamp: '2分钟前',
    icon: Code,
    type: 'success'
  },
  {
    id: 2,
    title: '部署流程优化',
    description: '优化了生产环境部署流程，预计可减少 30% 部署时间',
    timestamp: '5分钟前',
    icon: GitBranch,
    type: 'success'
  },
  {
    id: 3,
    title: '事件响应处理',
    description: '正在处理数据库连接超时事件，已启动自动恢复流程',
    timestamp: '10分钟前',
    icon: AlertCircle,
    type: 'processing'
  },
  {
    id: 4,
    title: '安全扫描报告',
    description: '完成了本周安全扫描，发现 2 个中等风险漏洞',
    timestamp: '1小时前',
    icon: Shield,
    type: 'success'
  }
])

// 切换助手状态
const toggleAssistant = (assistant: any) => {
  if (assistant.status === 'active') {
    // 打开配置对话框
    console.log('配置助手:', assistant.name)
  } else {
    // 激活助手
    assistant.status = 'active'
    assistant.lastActive = '刚刚'
    console.log('激活助手:', assistant.name)
  }
}
</script>