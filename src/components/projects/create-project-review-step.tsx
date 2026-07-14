'use client';

import { Database, Plus, Trash2 } from 'lucide-react';
import {
  DATABASE_PLAN_OPTIONS,
  DATABASE_TYPE_OPTIONS,
  DisclosurePanel,
  getPillChoiceClass,
  POSTGRES_CAPABILITY_OPTIONS,
  reviewShellClassName,
  reviewSubtleClassName,
  SectionHeading,
} from '@/components/projects/create-project-form-ui';
import type { CreateProjectFormController } from '@/components/projects/use-create-project-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supportsDatabaseProvisionType } from '@/lib/databases/platform-support';
import { createRuntimeProfiles, getServiceRuntimeSummary } from '@/lib/projects/create-defaults';
import {
  createDatabaseDraft,
  type DatabaseWithId,
  normalizeVariableKey,
} from '@/lib/projects/create-form-model';

interface CreateProjectReviewStepProps {
  controller: CreateProjectFormController;
}

export function CreateProjectReviewStep({ controller }: CreateProjectReviewStepProps) {
  const {
    activeServices,
    deploymentStrategyLabel,
    environmentTemplateLabel,
    formData,
    previewDatabaseStrategyLabel,
    readyInitialVariables,
    reviewDatabasesOpen,
    reviewServicesOpen,
    reviewVariablesOpen,
    setFormData,
    setReviewDatabasesOpen,
    setReviewServicesOpen,
    setReviewVariablesOpen,
    updateService,
  } = controller;

  return (
    <div className="space-y-6">
      <SectionHeading title="最后确认" />

      <div className={reviewShellClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              项目摘要
            </div>
            <div className="text-lg font-semibold text-foreground">{formData.name || '-'}</div>
            <div className="text-sm text-muted-foreground">
              {formData.mode === 'import'
                ? formData.repositoryFullName
                : `${formData.repositoryName} · ${formData.isPrivate ? '私有仓库' : '公开仓库'}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={formData.autoDeploy ? 'default' : 'secondary'}>
              {formData.autoDeploy ? '自动部署' : '手动部署'}
            </Badge>
            <Badge variant="secondary">{deploymentStrategyLabel}</Badge>
            <Badge variant="secondary">{previewDatabaseStrategyLabel}</Badge>
            <Badge variant="secondary">
              {createRuntimeProfiles.find((profile) => profile.value === formData.runtimeProfile)
                ?.label ?? formData.runtimeProfile}
            </Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className={reviewSubtleClassName}>
            <div className="text-xs text-muted-foreground">环境链路</div>
            <div className="mt-1 text-sm font-medium">{environmentTemplateLabel}</div>
          </div>
          <div className={reviewSubtleClassName}>
            <div className="text-xs text-muted-foreground">生产分支</div>
            <div className="mt-1 text-sm font-medium">{formData.productionBranch}</div>
          </div>
          <div className={reviewSubtleClassName}>
            <div className="text-xs text-muted-foreground">启用服务</div>
            <div className="mt-1 text-sm font-medium">{activeServices.length} 个</div>
          </div>
          <div className={reviewSubtleClassName}>
            <div className="text-xs text-muted-foreground">数据库</div>
            <div className="mt-1 text-sm font-medium">{formData.databases.length} 个</div>
          </div>
          <div className={reviewSubtleClassName}>
            <div className="text-xs text-muted-foreground">启动变量</div>
            <div className="mt-1 text-sm font-medium">{readyInitialVariables.length} 个</div>
          </div>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          访问域名：{formData.useCustomDomain ? formData.domain : '平台默认域名'}
        </div>
      </div>

      <DisclosurePanel
        title="变量明细"
        meta={`${readyInitialVariables.length} 个项目级变量`}
        open={reviewVariablesOpen}
        onToggle={() => setReviewVariablesOpen((current) => !current)}
      >
        {readyInitialVariables.length === 0 ? (
          <div className="console-card overflow-hidden">
            <EmptyState title="没有预置启动变量" className="min-h-32 rounded-none" />
          </div>
        ) : (
          <div className="space-y-2">
            {readyInitialVariables.map((variable) => (
              <div
                key={variable._id}
                className="console-inset flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-3"
              >
                <div className="font-mono text-sm font-medium">
                  {normalizeVariableKey(variable.key)}
                </div>
                <Badge variant="secondary">{variable.isSecret ? 'Secret' : 'Config'}</Badge>
              </div>
            ))}
          </div>
        )}
      </DisclosurePanel>

      <DisclosurePanel
        title="服务设置"
        meta={`${activeServices.length} 个启用`}
        open={reviewServicesOpen}
        onToggle={() => setReviewServicesOpen((current) => !current)}
      >
        <div className="space-y-3">
          {formData.services.length === 0 ? (
            <div className="console-card overflow-hidden">
              <EmptyState title="没有识别到服务" className="min-h-40 rounded-none" />
            </div>
          ) : (
            formData.services.map((service) => (
              <div key={service._id} className={reviewSubtleClassName}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-center gap-3">
                      <Switch
                        checked={!service.disabled}
                        onCheckedChange={() =>
                          updateService(service._id, (current) => ({
                            ...current,
                            disabled: !current.disabled,
                          }))
                        }
                      />
                      <div className="min-w-0 break-words font-medium">{service.name}</div>
                      <Badge variant="secondary">{service.type}</Badge>
                    </div>
                    <div className="min-w-0 break-all pl-11 text-xs text-muted-foreground">
                      {service.appDir} · 启动命令 {service.run.command}
                      {typeof service.run.port === 'number' ? ` · port ${service.run.port}` : ''}
                    </div>
                  </div>
                  <Badge variant="secondary" className="max-w-full break-words text-left">
                    {getServiceRuntimeSummary(service)}
                  </Badge>
                </div>

                {!service.disabled && (
                  <div className="mt-4 space-y-4 pl-11">
                    {service.type === 'web' && (
                      <div className="console-inset flex items-center justify-between rounded-[14px] px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">公网入口</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            决定是否对外暴露。
                          </div>
                        </div>
                        <Switch
                          checked={service.isPublic ?? true}
                          onCheckedChange={(checked) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              isPublic: checked,
                            }))
                          }
                        />
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>副本数</Label>
                        <Input
                          type="number"
                          min={1}
                          value={service.scaling?.min ?? 1}
                          onChange={(event) =>
                            updateService(service._id, (current) => {
                              const min = Number(event.target.value) || 1;
                              const max =
                                current.scaling?.max && current.scaling.max < min
                                  ? min
                                  : current.scaling?.max;
                              return {
                                ...current,
                                scaling: {
                                  ...current.scaling,
                                  min,
                                  ...(typeof max === 'number' ? { max } : {}),
                                },
                              };
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>端口</Label>
                        <Input
                          type="number"
                          min={1}
                          max={65535}
                          value={service.run.port ?? ''}
                          onChange={(event) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              run: {
                                ...current.run,
                                port: event.target.value ? Number(event.target.value) : undefined,
                              },
                            }))
                          }
                          disabled={service.type !== 'web'}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>健康检查路径</Label>
                        <Input
                          value={service.healthcheck?.path ?? ''}
                          onChange={(event) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              healthcheck: {
                                ...current.healthcheck,
                                path: event.target.value || undefined,
                                interval: current.healthcheck?.interval ?? 30,
                              },
                            }))
                          }
                          placeholder={service.type === 'web' ? '/api/health' : '/health'}
                          disabled={service.type !== 'web'}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label>CPU 请求</Label>
                        <Input
                          value={service.resources?.cpuRequest ?? ''}
                          onChange={(event) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              resources: {
                                ...current.resources,
                                cpuRequest: event.target.value,
                              },
                            }))
                          }
                          placeholder="100m"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>CPU 上限</Label>
                        <Input
                          value={service.resources?.cpuLimit ?? ''}
                          onChange={(event) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              resources: {
                                ...current.resources,
                                cpuLimit: event.target.value,
                              },
                            }))
                          }
                          placeholder="500m"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>内存请求</Label>
                        <Input
                          value={service.resources?.memoryRequest ?? ''}
                          onChange={(event) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              resources: {
                                ...current.resources,
                                memoryRequest: event.target.value,
                              },
                            }))
                          }
                          placeholder="256Mi"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>内存上限</Label>
                        <Input
                          value={service.resources?.memoryLimit ?? ''}
                          onChange={(event) =>
                            updateService(service._id, (current) => ({
                              ...current,
                              resources: {
                                ...current.resources,
                                memoryLimit: event.target.value,
                              },
                            }))
                          }
                          placeholder="512Mi"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DisclosurePanel>

      <DisclosurePanel
        title="数据库设置"
        meta={`${formData.databases.length} 个`}
        open={reviewDatabasesOpen}
        onToggle={() => setReviewDatabasesOpen((current) => !current)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {DATABASE_TYPE_OPTIONS.map((databaseType) => (
              <Button
                key={databaseType.value}
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full px-3"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    databases: [...prev.databases, createDatabaseDraft(databaseType.value)],
                  }))
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                {databaseType.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {formData.databases.length === 0 ? (
            <div className="console-card overflow-hidden">
              <EmptyState
                icon={<Database className="h-5 w-5 opacity-40" />}
                title="没有数据库"
                className="min-h-40 rounded-none"
              />
            </div>
          ) : (
            formData.databases.map((database) => {
              const updateDatabase = (updates: Partial<DatabaseWithId>) => {
                setFormData((prev) => ({
                  ...prev,
                  databases: prev.databases.map((item) =>
                    item._id === database._id ? { ...item, ...updates } : item
                  ),
                }));
              };

              return (
                <div key={database._id} className={reviewSubtleClassName}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={database.name}
                        onChange={(event) => updateDatabase({ name: event.target.value })}
                        className="h-9 w-44 min-w-0"
                      />
                      <Badge variant="secondary">
                        {
                          DATABASE_TYPE_OPTIONS.find((option) => option.value === database.type)
                            ?.label
                        }
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          databases: prev.databases.filter((item) => item._id !== database._id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>规格</Label>
                      <Select
                        value={database.plan}
                        onValueChange={(value: DatabaseWithId['plan']) =>
                          updateDatabase({ plan: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择规格" />
                        </SelectTrigger>
                        <SelectContent>
                          {DATABASE_PLAN_OPTIONS.map((plan) => (
                            <SelectItem key={plan.value} value={plan.value}>
                              {plan.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>接入方式</Label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { value: 'shared', label: '共享资源' },
                            { value: 'standalone', label: '独立资源' },
                            { value: 'external', label: '外部实例' },
                          ] as const
                        ).map((option) => {
                          const disabled = !supportsDatabaseProvisionType(
                            database.type,
                            option.value
                          );

                          return (
                            <Button
                              key={option.value}
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={disabled}
                              onClick={() => updateDatabase({ provisionType: option.value })}
                              className={getPillChoiceClass(
                                database.provisionType === option.value,
                                disabled
                              )}
                            >
                              {option.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {database.type === 'postgresql' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>数据库能力</Label>
                        {database.capabilities.length > 0 ? (
                          <Badge variant="secondary">{database.capabilities.length} 已启用</Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {POSTGRES_CAPABILITY_OPTIONS.map((option) => {
                          const selected = database.capabilities.includes(option.value);

                          return (
                            <Button
                              key={option.value}
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateDatabase({
                                  capabilities: selected
                                    ? database.capabilities.filter(
                                        (capability) => capability !== option.value
                                      )
                                    : [...database.capabilities, option.value],
                                })
                              }
                              className={getPillChoiceClass(selected)}
                            >
                              {option.label}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {POSTGRES_CAPABILITY_OPTIONS.map((option) => (
                          <span key={option.value}>{`${option.label}: ${option.description}`}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {database.provisionType === 'external' && (
                    <div className="space-y-2">
                      <Label>连接串</Label>
                      <Input
                        value={database.externalUrl ?? ''}
                        onChange={(event) => updateDatabase({ externalUrl: event.target.value })}
                        placeholder={
                          database.type === 'redis'
                            ? 'redis://:password@host:6379'
                            : database.type === 'mysql'
                              ? 'mysql://user:pass@host:3306/db'
                              : database.type === 'mongodb'
                                ? 'mongodb://user:pass@host:27017/db'
                                : 'postgresql://user:pass@host:5432/db'
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DisclosurePanel>
    </div>
  );
}
