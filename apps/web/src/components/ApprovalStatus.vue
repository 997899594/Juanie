<template>
  <div class="space-y-4">
    <!-- 待审批部署列表 -->
    <Card v-if="pendingApprovals && pendingApprovals.length > 0">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>待审批的部署</CardTitle>
            <CardDescription>需要您审批的生产环境部署请求</CardDescription>
          </div>
          <Badge variant="secondary" class="text-sm">
            {{ pendingApprovals.length }} 个待审批
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div 
            v-for="approval in pendingApprovals" 
            :key="approval.id"
            class="p-4 rounded-lg border bg-card"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 space-y-3">
                <!-- 部署信息 -->
                <div class="flex items-center gap-3">
                  <div class="p-2 rounded-lg bg-blue-100">
                    <Rocket class="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 class="font-semibold">{{ approval.deployment.name || `部署 #${approval.deployment.id.slice(0, 8)}` }}</h4>
                    <p class="text-sm text-muted-foreground">
                      {{ approval.deployment.environment }} 环境
                    </p>
                  </div>
                </div>

                <!-- 部署详情 -->
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-muted-foreground">版本</span>
                    <p class="font-medium">{{ approval.deployment.version || '-' }}</p>
                  </div>
                  <div>
                    <span class="text-muted-foreground">申请人</span>
                    <p class="font-medium">{{ approval.deployment.requestedBy || '-' }}</p>
                  </div>
                  <div>
                    <span class="text-muted-foreground">申请时间</span>
                    <p class="font-medium">{{ formatDate(approval.createdAt) }}</p>
                  </div>
                  <div>
                    <span class="text-muted-foreground">超时时间</span>
                    <p class="font-medium">{{ getTimeRemaining(approval.createdAt) }}</p>
                  </div>
                </div>

                <!-- 审批进度 -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">审批进度</span>
                    <span class="font-semibold">
                      {{ approval.approvedCount || 0 }} / {{ approval.totalApprovers || 0 }} 已批准
                    </span>
                  </div>
                  <div class="w-full bg-secondary rounded-full h-2">
                    <div 
                      class="h-2 rounded-full bg-blue-500 transition-all"
                      :style="{ width: `${getApprovalProgress(approval)}%` }"
                    />
                  </div>
                </div>

                <!-- 已审批人员 -->
                <div v-if="approval.approvers && approval.approvers.length > 0" class="space-y-2">
                  <p class="text-sm font-medium">审批人员</p>
                  <div class="flex flex-wrap gap-2">
                    <Badge 
                      v-for="approver in approval.approvers" 
                      :key="approver.id"
                      :variant="getApproverBadgeVariant(approver.status)"
                      class="text-xs"
                    >
                      {{ approver.name }}
                      <span v-if="approver.status === 'approved'" class="ml-1">✓</span>
                      <span v-else-if="approver.status === 'rejected'" class="ml-1">✗</span>
                      <span v-else class="ml-1">⏳</span>
                    </Badge>
                  </div>
                </div>

                <!-- 备注 -->
                <div v-if="approval.deployment.description" class="p-3 rounded-lg bg-muted">
                  <p class="text-sm text-muted-foreground">
                    {{ approval.deployment.description }}
                  </p>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex flex-col gap-2">
                <Button 
                  size="sm"
                  :disabled="approving === approval.id"
                  @click="openApproveDialog(approval)"
                >
                  <Check class="mr-2 h-4 w-4" />
                  批准
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  :disabled="rejecting === approval.id"
                  @click="openRejectDialog(approval)"
                >
                  <X class="mr-2 h-4 w-4" />
                  拒绝
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  @click="viewDeploymentDetails(approval.deployment)"
                >
                  <Info class="mr-2 h-4 w-4" />
                  详情
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 无待审批状态 -->
    <Card v-else>
      <CardContent class="py-12">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle class="h-8 w-8 text-green-600" />
          </div>
          <h3 class="text-lg font-semibold mb-2">暂无待审批部署</h3>
          <p class="text-sm text-muted-foreground">
            所有部署请求都已处理完成
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- 最近审批历史 -->
    <Card v-if="recentApprovals && recentApprovals.length > 0">
      <CardHeader>
        <CardTitle>最近审批历史</CardTitle>
        <CardDescription>最近 10 条审批记录</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-2">
          <div 
            v-for="approval in recentApprovals" 
            :key="approval.id"
            class="flex items-center justify-between p-3 rounded-lg border"
          >
            <div class="flex items-center gap-3">
              <Badge 
                :variant="approval.status === 'approved' ? 'default' : 'destructive'"
                class="text-xs"
              >
                {{ approval.status === 'approved' ? '已批准' : '已拒绝' }}
              </Badge>
              <div>
                <p class="text-sm font-medium">
                  {{ approval.deployment.name || `部署 #${approval.deployment.id.slice(0, 8)}` }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ approval.approver }} · {{ formatDate(approval.decidedAt) }}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              @click="viewApprovalDetails(approval)"
            >
              查看
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 批准确认对话框 -->
    <Dialog :open="!!approvalToApprove" @update:open="approvalToApprove = null">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>批准部署</DialogTitle>
          <DialogDescription>
            确认批准此部署到生产环境？
          </DialogDescription>
        </DialogHeader>
        <div v-if="approvalToApprove" class="space-y-4">
          <div class="p-4 rounded-lg border bg-muted">
            <p class="text-sm font-medium mb-2">
              {{ approvalToApprove.deployment.name || `部署 #${approvalToApprove.deployment.id.slice(0, 8)}` }}
            </p>
            <p class="text-sm text-muted-foreground">
              环境: {{ approvalToApprove.deployment.environment }}
            </p>
            <p class="text-sm text-muted-foreground">
              版本: {{ approvalToApprove.deployment.version || '-' }}
            </p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">备注（可选）</label>
            <textarea 
              v-model="approvalComment"
              class="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-background"
              placeholder="添加审批备注..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="approvalToApprove = null">取消</Button>
          <Button @click="handleApprove" :disabled="approving">
            <Loader2 v-if="approving" class="mr-2 h-4 w-4 animate-spin" />
            确认批准
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 拒绝确认对话框 -->
    <Dialog :open="!!approvalToReject" @update:open="approvalToReject = null">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>拒绝部署</DialogTitle>
          <DialogDescription>
            请说明拒绝此部署的原因
          </DialogDescription>
        </DialogHeader>
        <div v-if="approvalToReject" class="space-y-4">
          <div class="p-4 rounded-lg border bg-muted">
            <p class="text-sm font-medium mb-2">
              {{ approvalToReject.deployment.name || `部署 #${approvalToReject.deployment.id.slice(0, 8)}` }}
            </p>
            <p class="text-sm text-muted-foreground">
              环境: {{ approvalToReject.deployment.environment }}
            </p>
            <p class="text-sm text-muted-foreground">
              版本: {{ approvalToReject.deployment.version || '-' }}
            </p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">拒绝原因 *</label>
            <textarea 
              v-model="rejectionReason"
              class="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-background"
              placeholder="请说明拒绝原因..."
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="approvalToReject = null">取消</Button>
          <Button 
            variant="destructive" 
            @click="handleReject" 
            :disabled="rejecting || !rejectionReason"
          >
            <Loader2 v-if="rejecting" class="mr-2 h-4 w-4 animate-spin" />
            确认拒绝
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@juanie/ui'
import {
  Rocket,
  Check,
  X,
  Info,
  CheckCircle,
  Loader2,
} from 'lucide-vue-next'
import { format, formatDistanceToNow, addHours } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Props {
  pendingApprovals?: any[]
  recentApprovals?: any[]
}

defineProps<Props>()

const emit = defineEmits<{
  approve: [approvalId: string, comment?: string]
  reject: [approvalId: string, reason: string]
  viewDeployment: [deployment: any]
  viewApproval: [approval: any]
}>()

// 状态
const approvalToApprove = ref<any>(null)
const approvalToReject = ref<any>(null)
const approvalComment = ref('')
const rejectionReason = ref('')
const approving = ref(false)
const rejecting = ref(false)

// 方法
function openApproveDialog(approval: any) {
  approvalToApprove.value = approval
  approvalComment.value = ''
}

function openRejectDialog(approval: any) {
  approvalToReject.value = approval
  rejectionReason.value = ''
}

async function handleApprove() {
  if (!approvalToApprove.value) return
  
  approving.value = true
  try {
    emit('approve', approvalToApprove.value.id, approvalComment.value || undefined)
    approvalToApprove.value = null
    approvalComment.value = ''
  } finally {
    approving.value = false
  }
}

async function handleReject() {
  if (!approvalToReject.value || !rejectionReason.value) return
  
  rejecting.value = true
  try {
    emit('reject', approvalToReject.value.id, rejectionReason.value)
    approvalToReject.value = null
    rejectionReason.value = ''
  } finally {
    rejecting.value = false
  }
}

function viewDeploymentDetails(deployment: any) {
  emit('viewDeployment', deployment)
}

function viewApprovalDetails(approval: any) {
  emit('viewApproval', approval)
}

function formatDate(dateString: string | Date): string {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

function getTimeRemaining(createdAt: string | Date): string {
  const deadline = addHours(new Date(createdAt), 24)
  const now = new Date()
  
  if (deadline < now) {
    return '已超时'
  }
  
  return formatDistanceToNow(deadline, { locale: zhCN, addSuffix: true })
}

function getApprovalProgress(approval: any): number {
  if (!approval.totalApprovers || approval.totalApprovers === 0) return 0
  return Math.round((approval.approvedCount / approval.totalApprovers) * 100)
}

function getApproverBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default'
    case 'rejected':
      return 'destructive'
    case 'pending':
      return 'secondary'
    default:
      return 'outline'
  }
}
</script>
