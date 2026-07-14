'use client';

import { GitBranch, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  ChoiceCardButton,
  DisclosurePanel,
  reviewShellClassName,
  reviewSubtleClassName,
  SectionHeading,
} from '@/components/projects/create-project-form-ui';
import type { CreateProjectFormController } from '@/components/projects/use-create-project-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  createPreviewDatabaseStrategies,
  createProductionDeploymentStrategies,
  createRuntimeProfiles,
} from '@/lib/projects/create-defaults';
import {
  createInitialVariableDraft,
  getInitialVariableError,
  type InitialVariableWithId,
} from '@/lib/projects/create-form-model';
import { createEnvironmentTemplates } from '@/lib/projects/environment-topology';
import { cn } from '@/lib/utils';

interface CreateProjectConfigStepProps {
  controller: CreateProjectFormController;
}

export function CreateProjectConfigStep({ controller }: CreateProjectConfigStepProps) {
  const {
    configAdvancedOpen,
    formData,
    initialVariableErrors,
    isolatedCloneBlockedMessage,
    isLoadingAnalyze,
    readyInitialVariables,
    setConfigAdvancedOpen,
    setFormData,
    updateRuntimeProfile,
  } = controller;

  return (
    <div className="space-y-6">
      {isLoadingAnalyze ? (
        <div
          className={cn(reviewShellClassName, 'flex flex-col items-center justify-center py-12')}
        >
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-foreground" />
          <p className="text-sm text-muted-foreground">正在识别仓库结构...</p>
        </div>
      ) : null}

      <SectionHeading title="项目配置" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>项目名称</Label>
          <Input
            value={formData.name}
            onChange={(event) => {
              const name = event.target.value;
              setFormData((prev) => ({
                ...prev,
                name,
                slug: name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, ''),
              }));
            }}
            placeholder="nexusnote"
          />
        </div>

        <div className="space-y-2">
          <Label>项目标识</Label>
          <Input
            value={formData.slug}
            onChange={(event) => setFormData((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="nexusnote"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>描述</Label>
        <Textarea
          value={formData.description}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, description: event.target.value }))
          }
          placeholder="做什么"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>生产分支</Label>
          <div className="relative">
            <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={formData.productionBranch}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  productionBranch: event.target.value,
                }))
              }
              className="pl-9"
              placeholder="main"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>发布节奏</Label>
          <div className="ui-control flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">基础环境自动部署</div>
              </div>
              <Switch
                checked={formData.autoDeploy}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, autoDeploy: checked }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading title="资源档位" />
        <div className="grid gap-3 md:grid-cols-3">
          {createRuntimeProfiles.map((profile) => (
            <ChoiceCardButton
              key={profile.value}
              onClick={() => updateRuntimeProfile(profile.value)}
              title={profile.label}
              description={profile.description}
              selected={formData.runtimeProfile === profile.value}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading title="环境拓扑" />
        <div className="grid gap-3 md:grid-cols-3">
          {createEnvironmentTemplates.map((template) => (
            <ChoiceCardButton
              key={template.value}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  environmentTemplate: template.value,
                }))
              }
              title={template.label}
              description={template.description}
              selected={formData.environmentTemplate === template.value}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading title="生产发布" />
        <div className="grid gap-3 md:grid-cols-2">
          {createProductionDeploymentStrategies.map((strategy) => (
            <ChoiceCardButton
              key={strategy.value}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  productionDeploymentStrategy: strategy.value,
                }))
              }
              title={strategy.label}
              description={strategy.description}
              selected={formData.productionDeploymentStrategy === strategy.value}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading title="预览库策略" />
        <div className="grid gap-3 md:grid-cols-2">
          {createPreviewDatabaseStrategies.map((strategy) => (
            <ChoiceCardButton
              key={strategy.value}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  previewDatabaseStrategy: strategy.value,
                }))
              }
              title={strategy.label}
              description={strategy.description}
              selected={formData.previewDatabaseStrategy === strategy.value}
              disabled={strategy.value === 'isolated_clone' && Boolean(isolatedCloneBlockedMessage)}
            />
          ))}
        </div>
        {isolatedCloneBlockedMessage ? (
          <p className="text-sm text-muted-foreground">{isolatedCloneBlockedMessage}</p>
        ) : null}
      </div>

      <DisclosurePanel
        title="高级"
        open={configAdvancedOpen}
        onToggle={() => setConfigAdvancedOpen((current) => !current)}
      >
        <div className="space-y-3">
          <div className="ui-control flex items-center justify-between px-4 py-3">
            <div className="text-sm font-medium">自定义域名</div>
            <Switch
              checked={formData.useCustomDomain}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, useCustomDomain: checked }))
              }
            />
          </div>
          {formData.useCustomDomain && (
            <Input
              value={formData.domain}
              onChange={(event) => setFormData((prev) => ({ ...prev, domain: event.target.value }))}
              placeholder="app.example.com"
            />
          )}

          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">启动变量</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {readyInitialVariables.length > 0
                    ? `${readyInitialVariables.length} 个变量会注入初始环境`
                    : '没有预置变量'}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    initialVariables: [...prev.initialVariables, createInitialVariableDraft()],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                添加变量
              </Button>
            </div>

            {formData.initialVariables.length > 0 ? (
              <div className="space-y-2">
                {formData.initialVariables.map((variable) => {
                  const error = getInitialVariableError(variable, formData.initialVariables);
                  const updateVariable = (updates: Partial<InitialVariableWithId>) => {
                    setFormData((prev) => ({
                      ...prev,
                      initialVariables: prev.initialVariables.map((item) =>
                        item._id === variable._id ? { ...item, ...updates } : item
                      ),
                    }));
                  };

                  return (
                    <div key={variable._id} className={reviewSubtleClassName}>
                      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-start">
                        <div className="space-y-2">
                          <Label>变量名</Label>
                          <Input
                            value={variable.key}
                            onChange={(event) =>
                              updateVariable({ key: event.target.value.toUpperCase() })
                            }
                            placeholder="AI_302_API_KEY"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>变量值</Label>
                          <Input
                            value={variable.value}
                            onChange={(event) => updateVariable({ value: event.target.value })}
                            placeholder={variable.isSecret ? '创建后不会回显' : 'value'}
                            type={variable.isSecret ? 'password' : 'text'}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>密文</Label>
                          <div className="ui-control flex h-10 items-center gap-2 px-3">
                            <Switch
                              checked={variable.isSecret}
                              onCheckedChange={(checked) => updateVariable({ isSecret: checked })}
                            />
                            <span className="text-xs text-muted-foreground">
                              {variable.isSecret ? 'Secret' : 'Config'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-end md:h-[66px]">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                initialVariables: prev.initialVariables.filter(
                                  (item) => item._id !== variable._id
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>

                      {error ? <div className="mt-3 text-xs text-destructive">{error}</div> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {initialVariableErrors.length > 0 ? (
              <div className="rounded-[16px] bg-destructive/8 px-4 py-3 text-sm text-destructive">
                先修正变量配置后再继续。
              </div>
            ) : null}
          </div>
        </div>
      </DisclosurePanel>
    </div>
  );
}
