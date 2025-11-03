<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center space-x-2">
        <AlertCircle class="h-5 w-5" />
        <span>审批状态</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Approval status -->
      <div v-if="approvals.length === 0" class="text-sm text-muted-foreground">
        此部署不需要审批
      </div>

      <!-- Approval list -->
      <div v-else class="space-y-3">
        <div
          v-for="approval in approvals"
          :key="approval.id"
          class="flex items-center justify-between p-3 border rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <Avatar class="h-8 w-8">
              <AvatarFallback>{{ getInitials(approval.approverId) }}</AvatarFallback>
            </Avatar>
            <div>
              <p class="text-sm font-medium">{{ approval.approverId }}</p>
              <p v-if="approval.decidedAt" class="text-xs text-muted-foreground">
                {{ formatDate(approval.decidedAt) }}
              </p>
            </div>
          </div>
          <Badge :variant="getApprovalVariant(approval.status)">
            {{ getApprovalText(approval.status) }}
          </Badge>
        </div>
      </div>

      <!-- Approval actions -->
      <div v-if="canApprove" class="flex items-center space-x-2 pt-4 border-t">
        <Button
          variant="default"
          class="flex-1"
          :disabled="loading"
          @click="showApproveDialog = true"
        >
          <CheckCircle class="mr-2 h-4 w-4" />
          批准部署
        </Button>
        <Button
          variant="destructive"
          class="flex-1"
          :disabled="loading"
          @click="showRejectDialog = true"
        >
          <XCircle class="mr-2 h-4 w-4" />
          拒绝部署
        </Button>
      </div>
    </CardContent>

    <!-- Approve Dialog -->
    <Dialog v-model:open="showApproveDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批准部署</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <p class="text-sm text-muted-foreground">
            确认批准此部署？部署将在所有审批通过后自动执行。
          </p>
          <div class="space-y-2">
            <Label for="approve-comment">备注（可选）</Label>
            <Textarea
              id="approve-comment"
              v-model="approveComment"
              placeholder="添加审批备注..."
              rows="3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showApproveDialog = false">取消</Button>
          <Button :disabled="loading" @click="handleApprove">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            确认批准
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Reject Dialog -->
    <Dialog v-model:open="showRejectDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>拒绝部署</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <p class="text-sm text-muted-foreground">确认拒绝此部署？</p>
          <div class="space-y-2">
            <Label for="reject-reason">拒绝原因 *</Label>
            <Textarea
              id="reject-reason"
              v-model="rejectReason"
              placeholder="请说明拒绝原因..."
              rows="3"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showRejectDialog = false">取消</Button>
          <Button
            variant="destructive"
            :disabled="loading || !rejectReason.trim()"
            @click="handleReject"
          >
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            确认拒绝
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@juanie/ui'
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  deploymentId: string
  approvals: any[]
  currentUserId?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  approve: [comment?: string]
  reject: [reason: string]
}>()

const showApproveDialog = ref(false)
const showRejectDialog = ref(false)
const approveComment = ref('')
const rejectReason = ref('')

const canApprove = computed(() => {
  if (!props.currentUserId) return false

  // Check if current user has a pending approval
  return props.approvals.some(
    (approval) => approval.approverId === props.currentUserId && approval.status === 'pending',
  )
})

const getApprovalVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    approved: 'default',
    rejected: 'destructive',
    pending: 'secondary',
  }
  return variantMap[status] || 'outline'
}

const getApprovalText = (status: string) => {
  const textMap: Record<string, string> = {
    approved: '已批准',
    rejected: '已拒绝',
    pending: '待审批',
  }
  return textMap[status] || status
}

const getInitials = (name: string | null | undefined) => {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    const first = parts[0]?.[0] || ''
    const second = parts[1]?.[0] || ''
    return (first + second).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleApprove = () => {
  emit('approve', approveComment.value || undefined)
  showApproveDialog.value = false
  approveComment.value = ''
}

const handleReject = () => {
  if (!rejectReason.value.trim()) return
  emit('reject', rejectReason.value)
  showRejectDialog.value = false
  rejectReason.value = ''
}
</script>
