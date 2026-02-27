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
      setError('Key is required');
      return;
    }
    if (!form.value.trim() && !isEdit) {
      setError('Value is required');
      return;
    }
    // 编辑模式下，value 为空时跳过值更新（只改 key 或 isSecret）
    if (isEdit && !form.value.trim()) {
      setError('Enter a new value to update (secrets cannot be retrieved)');
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
        throw new Error(data.error ?? 'Failed to save variable');
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
          <DialogTitle>{isEdit ? 'Edit Variable' : 'Add Variable'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Key */}
          <div className="space-y-1.5">
            <Label htmlFor="env-key">Key</Label>
            <Input
              id="env-key"
              placeholder="e.g. DATABASE_URL"
              value={form.key}
              onChange={(e) =>
                setForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/\s/g, '_') }))
              }
              className="font-mono"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <Label htmlFor="env-value">
              {isEdit ? 'New Value' : 'Value'}
              {isEdit && (
                <span className="ml-1.5 text-xs text-muted-foreground">(required to update)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="env-value"
                type={form.isSecret && !showValue ? 'password' : 'text'}
                placeholder={isEdit ? 'Enter new value to replace...' : 'Value'}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="font-mono pr-9"
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

          {/* isSecret */}
          <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Secret</p>
              <p className="text-xs text-muted-foreground">
                Value will be encrypted. Cannot be viewed after saving.
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
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Add'}
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
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 group">
      {/* Key */}
      <div className="flex items-center gap-2 w-56 shrink-0">
        {envVar.isSecret && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <code className="text-sm font-mono truncate">{envVar.key}</code>
      </div>

      {/* Value */}
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

      {/* Badge */}
      {envVar.isSecret && (
        <span className="shrink-0 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <KeyRound className="h-3 w-3" />
          secret
        </span>
      )}

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <EnvVarDialog
          projectId={projectId}
          environmentId={environmentId}
          editTarget={envVar}
          onSuccess={onUpdated}
          trigger={
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
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
              <AlertDialogTitle>Delete variable?</AlertDialogTitle>
              <AlertDialogDescription>
                <code className="font-mono font-semibold text-foreground">{envVar.key}</code> will
                be permanently deleted and removed from the environment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium capitalize">{environmentName}</h3>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {vars.length === 0
                ? 'No variables'
                : `${plainCount} variable${plainCount !== 1 ? 's' : ''}${
                    secretCount > 0 ? `, ${secretCount} secret${secretCount !== 1 ? 's' : ''}` : ''
                  }`}
            </p>
          )}
        </div>
        <EnvVarDialog
          projectId={projectId}
          environmentId={environmentId}
          onSuccess={fetchVars}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          }
        />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b">
          <span className="w-56 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Key
          </span>
          <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Value
          </span>
        </div>

        {loading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                <div className="h-4 w-56 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : vars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <KeyRound className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No variables yet</p>
            <EnvVarDialog
              projectId={projectId}
              environmentId={environmentId}
              onSuccess={fetchVars}
              trigger={
                <Button size="sm" variant="outline" className="mt-1">
                  <Plus className="h-4 w-4" />
                  Add first variable
                </Button>
              }
            />
          </div>
        ) : (
          <div className={cn('divide-y')}>
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
