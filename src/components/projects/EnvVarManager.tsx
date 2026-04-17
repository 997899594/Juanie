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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface EffectiveEnvVar extends EnvVar {
  inherited: boolean;
  sourceLabel: string;
}

interface ServiceOverrideVar extends EnvVar {
  overridesEnvironmentValue: boolean;
  sourceLabel: string;
}

interface ServiceOverrideGroup {
  serviceId: string;
  serviceName: string;
  variables: ServiceOverrideVar[];
}

interface EnvVarOverview {
  direct: EnvVar[];
  effective: EffectiveEnvVar[];
  serviceOverrides: ServiceOverrideGroup[];
}

interface EnvVarManagerProps {
  projectId: string;
  environmentId: string;
  environmentName: string;
  canManage?: boolean;
  disabledSummary?: string | null;
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
  disabled?: boolean;
  disabledSummary?: string | null;
  onSuccess: () => void;
  trigger: React.ReactNode;
}

function EnvVarDialog({
  projectId,
  environmentId,
  editTarget,
  disabled = false,
  disabledSummary,
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
      <DialogContent
        size="form"
        className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
      >
        <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
          <DialogTitle>{isEdit ? '编辑变量' : '添加变量'}</DialogTitle>
          <DialogDescription>
            变量只作用于当前环境，密文值不会回显，更新时需要重新输入。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <div className="ui-control-muted p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="env-key">变量名</Label>
                  <Input
                    id="env-key"
                    placeholder="DATABASE_URL"
                    value={form.key}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        key: e.target.value.toUpperCase().replace(/\s/g, '_'),
                      }))
                    }
                    className="font-mono"
                    autoComplete="off"
                    autoFocus
                    disabled={disabled}
                  />
                </div>

                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="env-value">
                    {isEdit ? '新变量值' : '变量值'}
                    {isEdit && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(更新时必填)</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="env-value"
                      type={form.isSecret && !showValue ? 'password' : 'text'}
                      placeholder={isEdit ? '输入新值' : '输入值'}
                      value={form.value}
                      onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                      className="pr-9 font-mono"
                      autoComplete="off"
                      disabled={disabled}
                    />
                    {form.isSecret && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowValue((v) => !v)}
                        className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-xl text-muted-foreground"
                        tabIndex={-1}
                      >
                        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="ui-control flex items-center gap-3 px-4 py-4">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">密文变量</p>
                </div>
                <Switch
                  checked={form.isSecret}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isSecret: checked }))}
                  disabled={disabled}
                />
              </div>

              {disabledSummary && (
                <div className="ui-control-muted rounded-[20px] px-4 py-3 text-sm text-muted-foreground">
                  {disabledSummary}
                </div>
              )}

              {error && (
                <div className="ui-control rounded-[20px] bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving || disabled}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '更新变量' : '添加变量'}
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
  canManage: boolean;
  disabledSummary?: string | null;
  onUpdated: () => void;
  onDeleted: () => void;
}

function EnvVarRow({
  envVar,
  projectId,
  environmentId,
  canManage,
  disabledSummary,
  onUpdated,
  onDeleted,
}: EnvVarRowProps) {
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
    <div className="group px-4 py-4 transition-colors hover:bg-secondary/30 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          {envVar.isSecret && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <code className="truncate text-sm font-mono">{envVar.key}</code>
          {envVar.isSecret && (
            <span className="ui-control-muted inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              密文
            </span>
          )}
        </div>

        <div className="min-w-0 px-1 sm:px-0">
          {envVar.isSecret ? (
            <span className="select-none font-mono text-sm tracking-widest text-muted-foreground">
              ••••••••••••
            </span>
          ) : (
            <code className="block truncate text-sm font-mono text-muted-foreground">
              {envVar.value ?? ''}
            </code>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <EnvVarDialog
            projectId={projectId}
            environmentId={environmentId}
            editTarget={envVar}
            disabled={!canManage}
            disabledSummary={disabledSummary}
            onSuccess={onUpdated}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canManage}
                title={!canManage ? (disabledSummary ?? undefined) : undefined}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={!canManage}
                title={!canManage ? (disabledSummary ?? undefined) : undefined}
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
                  会被永久删除，并从环境移除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="w-full sm:w-auto">取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function ReadonlyEnvVarRow({ envVar, badges }: { envVar: EnvVar; badges?: string[] }) {
  return (
    <div className="px-4 py-4 transition-colors hover:bg-secondary/30 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          {envVar.isSecret && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <code className="truncate text-sm font-mono">{envVar.key}</code>
          {envVar.isSecret && (
            <span className="ui-control-muted inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              密文
            </span>
          )}
        </div>

        <div className="min-w-0 px-1 sm:px-0">
          {envVar.isSecret ? (
            <span className="select-none font-mono text-sm tracking-widest text-muted-foreground">
              ••••••••••••
            </span>
          ) : (
            <code className="block truncate text-sm font-mono text-muted-foreground">
              {envVar.value ?? ''}
            </code>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {(badges ?? []).map((badge) => (
            <span
              key={`${envVar.id}-${badge}`}
              className="ui-control-muted inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceOverridePanel({ groups }: { groups: ServiceOverrideGroup[] }) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<KeyRound className="h-8 w-8 text-muted-foreground/40" />}
        title="没有服务级变量"
        className="min-h-44"
      />
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.serviceId} className="console-grid-table overflow-hidden rounded-[20px]">
          <div className="console-grid-table-head bg-secondary/30 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <code className="text-sm font-medium">{group.serviceName}</code>
              <span className="text-xs text-muted-foreground">
                {group.variables.length} 个服务级变量
              </span>
            </div>
          </div>
          <div className="console-list bg-background">
            {group.variables.map((variable) => (
              <ReadonlyEnvVarRow
                key={variable.id}
                envVar={variable}
                badges={[
                  variable.sourceLabel,
                  variable.overridesEnvironmentValue ? '覆盖环境级同名键' : '仅服务级',
                ]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function EnvVarManager({
  projectId,
  environmentId,
  environmentName,
  canManage = true,
  disabledSummary,
}: EnvVarManagerProps) {
  const [overview, setOverview] = useState<EnvVarOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/env-vars/overview?environmentId=${environmentId}`
      );
      if (res.ok) {
        setOverview((await res.json()) as EnvVarOverview);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, environmentId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const directVars = overview?.direct ?? [];
  const effectiveVars = overview?.effective ?? [];
  const serviceOverrides = overview?.serviceOverrides ?? [];
  const directSecretCount = directVars.filter((v) => v.isSecret).length;
  const directPlainCount = directVars.length - directSecretCount;
  const serviceOverrideCount = serviceOverrides.reduce(
    (count, group) => count + group.variables.length,
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium capitalize">{environmentName}</h3>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {[
                directVars.length === 0
                  ? '没有直接变量'
                  : `${directPlainCount} 个普通变量${directSecretCount > 0 ? `，${directSecretCount} 个密文变量` : ''}`,
                effectiveVars.length > 0 ? `实际生效 ${effectiveVars.length} 个` : null,
                serviceOverrideCount > 0 ? `服务覆盖 ${serviceOverrideCount} 个` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <EnvVarDialog
          projectId={projectId}
          environmentId={environmentId}
          disabled={!canManage}
          disabledSummary={disabledSummary}
          onSuccess={fetchOverview}
          trigger={
            <Button
              size="sm"
              variant="default"
              disabled={!canManage}
              title={!canManage ? (disabledSummary ?? undefined) : undefined}
            >
              <Plus className="h-4 w-4" />
              添加
            </Button>
          }
        />
      </div>

      {!canManage && disabledSummary && (
        <div className="text-xs text-muted-foreground">{disabledSummary}</div>
      )}

      <Tabs defaultValue="direct" className="space-y-4">
        <TabsList className="h-11">
          <TabsTrigger value="direct">直配变量</TabsTrigger>
          <TabsTrigger value="effective">实际生效</TabsTrigger>
          <TabsTrigger value="service">服务覆盖</TabsTrigger>
        </TabsList>

        <TabsContent value="direct">
          <div className="console-grid-table overflow-hidden rounded-[20px] bg-background">
            <div className="console-grid-table-head hidden items-center gap-3 bg-secondary/30 px-5 py-3 sm:flex">
              <span className="w-56 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                变量名
              </span>
              <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                变量值
              </span>
            </div>

            {loading ? (
              <div className="console-list">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="space-y-3 px-4 py-4 sm:flex sm:items-center sm:gap-3 sm:px-5"
                  >
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-12 w-full animate-pulse rounded-xl bg-muted sm:h-4 sm:w-56 sm:rounded" />
                  </div>
                ))}
              </div>
            ) : directVars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <KeyRound className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">还没有直接变量</p>
                <EnvVarDialog
                  projectId={projectId}
                  environmentId={environmentId}
                  disabled={!canManage}
                  disabledSummary={disabledSummary}
                  onSuccess={fetchOverview}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      disabled={!canManage}
                      title={!canManage ? (disabledSummary ?? undefined) : undefined}
                    >
                      <Plus className="h-4 w-4" />
                      添加第一个变量
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className={cn('console-list')}>
                {directVars.map((v) => (
                  <EnvVarRow
                    key={v.id}
                    envVar={v}
                    projectId={projectId}
                    environmentId={environmentId}
                    canManage={canManage}
                    disabledSummary={disabledSummary}
                    onUpdated={fetchOverview}
                    onDeleted={fetchOverview}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="effective">
          <div className="console-grid-table overflow-hidden rounded-[20px] bg-background">
            {loading ? (
              <div className="console-list">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="space-y-3 px-4 py-4 sm:flex sm:items-center sm:gap-3 sm:px-5"
                  >
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-12 w-full animate-pulse rounded-xl bg-muted sm:h-4 sm:w-56 sm:rounded" />
                  </div>
                ))}
              </div>
            ) : effectiveVars.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <KeyRound className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">没有生效变量</p>
              </div>
            ) : (
              <div className="console-list">
                {effectiveVars.map((envVar) => (
                  <ReadonlyEnvVarRow
                    key={envVar.id}
                    envVar={envVar}
                    badges={[envVar.sourceLabel, ...(envVar.inherited ? ['继承链'] : [])]}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="service">
          <div className="mb-3 px-1 text-sm text-muted-foreground">
            这些变量按服务生效，会在对应容器启动时追加注入；如果键名相同，会覆盖环境级同名变量。
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-[20px] bg-muted" />
              ))}
            </div>
          ) : (
            <ServiceOverridePanel groups={serviceOverrides} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
