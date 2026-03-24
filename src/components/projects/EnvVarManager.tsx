'use client';

import { Eye, EyeOff, KeyRound, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface EnvVar {
  id: string;
  key: string;
  value: string | null; // null 表示 secret（只写不读）
  isSecret: boolean;
  environmentId: string | null;
  serviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EnvVarManagerProps {
  projectId: string;
  environmentId: string; // 当前环境 ID
  environmentName: string;
}

// ============================================
// 添加/编辑变量弹窗
// ============================================

interface EnvVarFormData {
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvVarDialogProps {
  projectId: string;
  environmentId: string;
  editTarget?: EnvVar; // 有值时为编辑模式
  onSuccess: () => void;
  trigger: React.ReactNode;
}

function EnvVarDialog({
  projectId,
  environmentId,
  editTarget,
  onSuccess,
  trigger,
}: EnvVarDialogProps) {
  const isEdit = !!editTarget;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(false);

  const [form, setForm] = useState<EnvVarFormData>({
    key: editTarget?.key ?? '',
    value: '',
    isSecret: editTarget?.isSecret ?? false,
  });

  // 打开时重置表单
  useEffect(() => {
    if (open) {
      setForm({
        key: editTarget?.key ?? '',
        value: '',
        isSecret: editTarget?.isSecret ?? false,
      });
      setError(null);
      setShowValue(false);
    }
  }, [open, editTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key.trim()) {
      setError('变量名不能为空');
      return;
    }
    if (!form.value.trim() && !isEdit) {
      setError('变量值不能为空');
      return;
    }
    // 编辑模式下，value 为空时跳过值更新（只改 key 或 isSecret）
    if (isEdit && !form.value.trim()) {
      setError('请输入新的变量值后再更新，密文变量无法回显');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/projects/${projectId}/env-vars/${editTarget.id}`
        : `/api/projects/${projectId}/env-vars`;
      const method = isEdit ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        key: form.key.trim(),
        value: form.value,
        isSecret: form.isSecret,
      };
      if (!isEdit) {
        body.environmentId = environmentId;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? '保存变量失败');
      }

      setOpen(false);
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑变量' : '添加变量'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="env-key">变量名</Label>
            <Input
              id="env-key"
              placeholder="例如 DATABASE_URL"
              value={form.key}
              onChange={(e) =>
                setForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/\s/g, '_') }))
              }
              className="h-11 rounded-xl font-mono"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-value">
              {isEdit ? '新变量值' : '变量值'}
              {isEdit && <span className="ml-1.5 text-xs text-muted-foreground">(更新时必填)</span>}
            </Label>
            <div className="relative">
              <Input
                id="env-value"
                type={form.isSecret && !showValue ? 'password' : 'text'}
                placeholder={isEdit ? '输入新的变量值以覆盖旧值' : '输入变量值'}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="h-11 rounded-xl pr-9 font-mono"
                autoComplete="off"
              />
              {form.isSecret && (
                <button
                  type="button"
                  onClick={() => setShowValue((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/20 px-4 py-3">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">密文变量</p>
              <p className="text-xs text-muted-foreground">
                保存后会加密，之后无法在页面中查看原值。
              </p>
            </div>
            <Switch
              checked={form.isSecret}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isSecret: checked }))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button type="submit" className="rounded-xl" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '更新' : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// 变量行
// ============================================

interface EnvVarRowProps {
  envVar: EnvVar;
  projectId: string;
  environmentId: string;
  onUpdated: () => void;
  onDeleted: () => void;
}

function EnvVarRow({ envVar, projectId, environmentId, onUpdated, onDeleted }: EnvVarRowProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/env-vars/${envVar.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeleted();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/30">
      <div className="flex items-center gap-2 w-56 shrink-0">
        {envVar.isSecret && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <code className="text-sm font-mono truncate">{envVar.key}</code>
      </div>

      <div className="flex-1 min-w-0">
        {envVar.isSecret ? (
          <span className="text-sm text-muted-foreground font-mono tracking-widest select-none">
            ••••••••••••
          </span>
        ) : (
          <code className="text-sm font-mono text-muted-foreground truncate block">
            {envVar.value ?? ''}
          </code>
        )}
      </div>

      {envVar.isSecret && (
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          <KeyRound className="h-3 w-3" />
          密文
        </span>
      )}

      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <EnvVarDialog
          projectId={projectId}
          environmentId={environmentId}
          editTarget={envVar}
          onSuccess={onUpdated}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除变量？</AlertDialogTitle>
              <AlertDialogDescription>
                <code className="font-mono font-semibold text-foreground">{envVar.key}</code>{' '}
                会被永久删除，并从当前环境移除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function EnvVarManager({ projectId, environmentId, environmentName }: EnvVarManagerProps) {
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/env-vars?environmentId=${environmentId}`);
      if (res.ok) {
        setVars(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, environmentId]);

  useEffect(() => {
    fetchVars();
  }, [fetchVars]);

  const secretCount = vars.filter((v) => v.isSecret).length;
  const plainCount = vars.length - secretCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium capitalize">{environmentName}</h3>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {vars.length === 0
                ? '没有变量'
                : `${plainCount} 个普通变量${secretCount > 0 ? `，${secretCount} 个密文变量` : ''}`}
            </p>
          )}
        </div>
        <EnvVarDialog
          projectId={projectId}
          environmentId={environmentId}
          onSuccess={fetchVars}
          trigger={
            <Button size="sm" variant="outline" className="rounded-xl">
              <Plus className="h-4 w-4" />
              添加
            </Button>
          }
        />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-border bg-background">
        <div className="flex items-center gap-3 border-b border-border/70 bg-secondary/30 px-5 py-3">
          <span className="w-56 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            变量名
          </span>
          <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            变量值
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-border/70">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-56 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : vars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <KeyRound className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">还没有变量</p>
            <EnvVarDialog
              projectId={projectId}
              environmentId={environmentId}
              onSuccess={fetchVars}
              trigger={
                <Button size="sm" variant="outline" className="mt-1 rounded-xl">
                  <Plus className="h-4 w-4" />
                  添加第一个变量
                </Button>
              }
            />
          </div>
        ) : (
          <div className={cn('divide-y divide-border/70')}>
            {vars.map((v) => (
              <EnvVarRow
                key={v.id}
                envVar={v}
                projectId={projectId}
                environmentId={environmentId}
                onUpdated={fetchVars}
                onDeleted={fetchVars}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
