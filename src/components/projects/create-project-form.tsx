'use client';

import { Check, ChevronLeft, ChevronRight, Globe, Search, Shield } from 'lucide-react';
import { CreateProjectConfigStep } from '@/components/projects/create-project-config-step';
import {
  ChoiceCardButton,
  reviewShellClassName,
  SectionHeading,
  TeamAccessDetails,
} from '@/components/projects/create-project-form-ui';
import { CreateProjectReviewStep } from '@/components/projects/create-project-review-step';
import {
  CREATE_PROJECT_STEPS,
  type CreateProjectFormProps,
  useCreateProjectForm,
} from '@/components/projects/use-create-project-form';
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
import { buildTemplateServiceDrafts } from '@/lib/projects/create-form-model';
import { cn } from '@/lib/utils';

export function CreateProjectForm({ teamScopes, templates }: CreateProjectFormProps) {
  const controller = useCreateProjectForm({ teamScopes, templates });
  const {
    canProceed,
    currentStep,
    currentStepIndex,
    formData,
    handleBack,
    handleNext,
    handleSearch,
    handleSubmit,
    isFirstStep,
    isLastStep,
    isSubmitting,
    repositories,
    searchQuery,
    selectRepository,
    selectedTeam,
    setFormData,
    switchMode,
    updateTeamId,
  } = controller;

  return (
    <div className="w-full">
      <div className="console-panel mb-8 px-2 py-2">
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              创建项目
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {CREATE_PROJECT_STEPS[currentStepIndex]?.title}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {currentStepIndex + 1} / {CREATE_PROJECT_STEPS.length}
          </div>
        </div>
        <div className="flex min-w-max items-center justify-between gap-2 overflow-x-auto pb-1">
          {CREATE_PROJECT_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]',
                  index <= currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/75 text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'ml-2 hidden text-sm sm:block',
                  index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
              {index < CREATE_PROJECT_STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-px w-10 shrink-0 sm:w-16',
                    index < currentStepIndex ? 'bg-primary/55' : 'bg-border/60'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {currentStep === 'mode' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <SectionHeading title="项目入口方式" />

              <div className="space-y-2">
                <Label>团队</Label>
                <Select value={formData.teamId} onValueChange={updateTeamId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="选择团队" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamScopes.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ChoiceCardButton
                  title="导入仓库"
                  description="连接现有 Git 仓库"
                  selected={formData.mode === 'import'}
                  onClick={() => switchMode('import')}
                  dense
                />

                <ChoiceCardButton
                  title="新建仓库"
                  description="从平台模板创建新仓库"
                  selected={formData.mode === 'create'}
                  onClick={() => switchMode('create')}
                  dense
                />
              </div>

              {selectedTeam ? <TeamAccessDetails team={selectedTeam} /> : null}
            </div>
          </div>
        )}

        {currentStep === 'repository' && (
          <div className="space-y-6">
            <div className={cn(reviewShellClassName, 'p-4')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{selectedTeam?.name}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formData.mode === 'import' ? '导入现有仓库' : '创建新仓库'}
                </div>
              </div>
            </div>

            {selectedTeam ? <TeamAccessDetails team={selectedTeam} /> : null}

            {formData.mode === 'import' ? (
              <>
                <SectionHeading title="选择要接入的仓库" />

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => handleSearch(event.target.value)}
                    placeholder="搜索仓库..."
                    className="pl-9"
                  />
                </div>

                <div className={cn(reviewShellClassName, 'max-h-96 overflow-y-auto p-0')}>
                  {!selectedTeam?.importEnabled ? (
                    <EmptyState title="没有可用代码托管授权" className="min-h-40 rounded-none" />
                  ) : repositories.length === 0 ? (
                    <EmptyState title="没有找到仓库" className="min-h-40 rounded-none" />
                  ) : (
                    repositories.map((repository) => (
                      <Button
                        key={repository.id}
                        type="button"
                        variant="ghost"
                        onClick={() => selectRepository(repository)}
                        className={cn(
                          'h-auto w-full justify-between rounded-none px-4 py-4 text-left font-normal whitespace-normal hover:bg-secondary/48',
                          formData.repositoryId === repository.id &&
                            'bg-[rgba(241,239,235,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]'
                        )}
                      >
                        <div>
                          <div className="font-medium">{repository.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            默认分支 {repository.defaultBranch}
                          </div>
                        </div>
                        {formData.repositoryId === repository.id && (
                          <Check className="h-4 w-4 text-foreground" />
                        )}
                      </Button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <SectionHeading title="定义新仓库骨架" />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>仓库名称</Label>
                    <Input
                      value={formData.repositoryName}
                      onChange={(event) => {
                        const repositoryName = event.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          repositoryName,
                          name: repositoryName,
                          slug: repositoryName
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        }));
                      }}
                      placeholder="nexusnote"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>仓库可见性</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <ChoiceCardButton
                        title="公开"
                        description="适合开源项目"
                        selected={!formData.isPrivate}
                        onClick={() => setFormData((prev) => ({ ...prev, isPrivate: false }))}
                        icon={<Globe className="h-4 w-4" />}
                        dense
                      />
                      <ChoiceCardButton
                        title="私有"
                        description="适合业务仓库"
                        selected={formData.isPrivate}
                        onClick={() => setFormData((prev) => ({ ...prev, isPrivate: true }))}
                        icon={<Shield className="h-4 w-4" />}
                        dense
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>模板</Label>
                  {templates.length === 0 ? (
                    <EmptyState title="没有可用模板" className="min-h-40" />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {templates.map((template) => (
                        <ChoiceCardButton
                          key={template.id}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              template: template.id,
                              services: buildTemplateServiceDrafts(
                                template.id,
                                prev.runtimeProfile
                              ),
                            }))
                          }
                          title={template.name}
                          description={template.description}
                          selected={formData.template === template.id}
                          dense
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentStep === 'config' ? <CreateProjectConfigStep controller={controller} /> : null}

        {currentStep === 'review' ? <CreateProjectReviewStep controller={controller} /> : null}
      </div>

      <div className="pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 mt-6 -mx-4 px-4 py-3 md:static md:mx-0 md:px-0 md:py-0">
        <div
          className={cn(
            reviewShellClassName,
            'pointer-events-auto flex items-center justify-between gap-3 p-3 md:bg-transparent md:p-0 md:shadow-none'
          )}
        >
          <Button
            variant="ghost"
            className="rounded-full px-4"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一步
          </Button>

          {isLastStep ? (
            <Button
              className="px-4"
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? '创建中...' : '创建项目'}
            </Button>
          ) : (
            <Button className="px-4" onClick={handleNext} disabled={!canProceed()}>
              继续
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
