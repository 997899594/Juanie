'use client';

import { useForm } from '@tanstack/react-form';
import { Eye, EyeOff, KeyRound, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSection,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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

function normalizeEnvVarKey(value: string): string {
  return value.toUpperCase().replace(/\s/g, '_');
}

function getErrorMessage(errors: unknown[]): string | null {
  const firstError = errors[0];

  if (typeof firstError === 'string') {
    return firstError;
  }

  if (
    typeof firstError === 'object' &&
    firstError !== null &&
    'message' in firstError &&
    typeof firstError.message === 'string'
  ) {
    return firstError.message;
  }

  return null;
}

const shellClassName =
  'rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';

const subCardClassName =
  'rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

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
  const [showValue, setShowValue] = useState(false);

  const form = useForm({
    defaultValues: {
      key: editTarget?.key ?? '',
      value: '',
      isSecret: editTarget?.isSecret ?? false,
    } satisfies EnvVarFormData,
    onSubmit: async ({ value }) => {
      const url = isEdit
        ? `/api/projects/${projectId}/env-vars/${editTarget.id}`
        : `/api/projects/${projectId}/env-vars`;
      const method = isEdit ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        key: value.key.trim(),
        value: value.value,
        isSecret: value.isSecret,
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
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? '保存变量失败');
      }

      toast.success(isEdit ? '变量已更新' : '变量已添加');
      setOpen(false);
      onSuccess();
      form.reset();
    },
  });

  // 打开时重置表单
  useEffect(() => {
    if (open) {
      form.reset({
        key: editTarget?.key ?? '',
        value: '',
        isSecret: editTarget?.isSecret ?? false,
      });
      setShowValue(false);
    }
  }, [open, editTarget, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="form" layout="form">
        <DialogHeader chrome>
          <DialogTitle>{isEdit ? '编辑变量' : '添加变量'}</DialogTitle>
          <DialogDescription>
            变量只作用于当前环境，密文值不会回显，更新时需要重新输入。
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit().catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : '保存变量失败');
            });
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody>
            <FormSection className="space-y-4 px-0 py-0 shadow-none">
              <form.Field
                name="key"
                validators={{
                  onChange: ({ value }) => {
                    if (!value.trim()) {
                      return '变量名不能为空';
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <FormField>
                    <FormLabel htmlFor={field.name}>变量名</FormLabel>
                    <Input
                      id={field.name}
                      placeholder="DATABASE_URL"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(normalizeEnvVarKey(e.target.value))}
                      className="font-mono"
                      autoComplete="off"
                      autoFocus
                      disabled={disabled}
                      aria-invalid={field.state.meta.errors.length > 0}
                    />
                    <FormMessage>
                      {field.state.meta.isTouched ? getErrorMessage(field.state.meta.errors) : null}
                    </FormMessage>
                  </FormField>
                )}
              </form.Field>

              <form.Field
                name="value"
                validators={{
                  onChange: ({ value }) => {
                    if (!value.trim()) {
                      return isEdit ? '请输入新的变量值后再更新' : '变量值不能为空';
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <form.Field name="isSecret">
                    {(secretField) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>
                          {isEdit ? '新变量值' : '变量值'}
                          {isEdit ? (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              (更新时必填)
                            </span>
                          ) : null}
                        </FormLabel>
                        <div className="relative">
                          <Input
                            id={field.name}
                            type={secretField.state.value && !showValue ? 'password' : 'text'}
                            placeholder={isEdit ? '输入新值' : '输入值'}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className="pr-9 font-mono"
                            autoComplete="off"
                            disabled={disabled}
                            aria-invalid={field.state.meta.errors.length > 0}
                          />
                          {secretField.state.value ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowValue((v) => !v)}
                              className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-muted-foreground"
                              tabIndex={-1}
                            >
                              {showValue ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                        <FormMessage>
                          {field.state.meta.isTouched
                            ? getErrorMessage(field.state.meta.errors)
                            : null}
                        </FormMessage>
                      </FormField>
                    )}
                  </form.Field>
                )}
              </form.Field>

              <form.Field name="isSecret">
                {(field) => (
                  <div className="flex items-center gap-3 rounded-[18px] bg-[rgba(255,255,255,0.88)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.025)]">
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">密文变量</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        开启后只写不读，详情页不会回显真实值。
                      </p>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      disabled={disabled}
                    />
                  </div>
                )}
              </form.Field>

              {disabledSummary ? <FormDescription>{disabledSummary}</FormDescription> : null}
            </FormSection>
          </DialogBody>

          <DialogFooter chrome>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  className="w-full rounded-full sm:w-auto"
                  disabled={!canSubmit || disabled}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isEdit ? '更新变量' : '添加变量'}
                </Button>
              )}
            </form.Subscribe>
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
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? '删除变量失败');
      }
      toast.success('变量已删除');
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除变量失败');
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
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(243,240,233,0.7)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.62)_inset]">
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
            <AlertDialogContent size="form">
              <AlertDialogHeader>
                <AlertDialogTitle>删除变量？</AlertDialogTitle>
                <AlertDialogDescription>
                  <code className="font-mono font-semibold text-foreground">{envVar.key}</code>{' '}
                  会被永久删除，并从环境移除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="w-full rounded-full sm:w-auto">
                  取消
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
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
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(243,240,233,0.7)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.62)_inset]">
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
              className="inline-flex items-center rounded-full bg-[rgba(243,240,233,0.7)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.62)_inset]"
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
        <div key={group.serviceId} className={shellClassName}>
          <div className="px-0 pb-4">
            <div className="flex items-center gap-2">
              <code className="text-sm font-medium">{group.serviceName}</code>
              <span className="text-xs text-muted-foreground">
                {group.variables.length} 个服务级变量
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[18px] bg-white/72">
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
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-medium capitalize">{environmentName}</h3>
          {!loading && (
            <p className="mt-1 text-sm text-muted-foreground">变量、继承链和服务覆盖都收在这里。</p>
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
              className="rounded-full"
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

      {!loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              直配
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{directVars.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {directPlainCount} 普通
              {directSecretCount > 0 ? ` · ${directSecretCount} 密文` : ''}
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              生效
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{effectiveVars.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">当前环境实际拿到的变量总数</div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              服务覆盖
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{serviceOverrideCount}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {serviceOverrides.length} 个服务存在覆盖项
            </div>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="direct" className="space-y-4">
        <TabsList className="h-11 rounded-full bg-[rgba(243,240,233,0.72)] p-1">
          <TabsTrigger value="direct">直配变量</TabsTrigger>
          <TabsTrigger value="effective">实际生效</TabsTrigger>
          <TabsTrigger value="service">服务覆盖</TabsTrigger>
        </TabsList>

        <TabsContent value="direct">
          <div className={shellClassName}>
            <div className="hidden items-center gap-3 px-0 pb-4 sm:flex">
              <span className="w-56 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                变量名
              </span>
              <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                变量值
              </span>
            </div>

            {loading ? (
              <div className="overflow-hidden rounded-[18px] bg-white/72">
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
                      variant="ghost"
                      className="mt-1 rounded-full px-4"
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
              <div className={cn('overflow-hidden rounded-[18px] bg-white/72')}>
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
          <div className={shellClassName}>
            {loading ? (
              <div className="overflow-hidden rounded-[18px] bg-white/72">
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
              <div className="overflow-hidden rounded-[18px] bg-white/72">
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
            只看服务级追加项；同名键会覆盖环境级值。
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
