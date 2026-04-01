export interface RuntimeStatusDecoration {
  color: 'success' | 'warning' | 'error' | 'neutral';
  label: string;
}

const runtimeStatusDecorations: Record<string, RuntimeStatusDecoration> = {
  active: { color: 'success', label: '运行中' },
  running: { color: 'success', label: '运行中' },
  initializing: { color: 'warning', label: '初始化中' },
  pending: { color: 'warning', label: '待处理' },
  failed: { color: 'error', label: '失败' },
  archived: { color: 'neutral', label: '已归档' },
};

export function getRuntimeStatusDecoration(status?: string | null): RuntimeStatusDecoration {
  if (!status) {
    return runtimeStatusDecorations.pending;
  }

  return runtimeStatusDecorations[status] ?? { color: 'neutral', label: status };
}

export function formatRuntimeStatusLabel(status?: string | null): string {
  return getRuntimeStatusDecoration(status).label;
}

export function getRuntimeStatusDotClass(status?: string | null): string {
  switch (getRuntimeStatusDecoration(status).color) {
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-destructive';
    default:
      return 'bg-muted-foreground';
  }
}
