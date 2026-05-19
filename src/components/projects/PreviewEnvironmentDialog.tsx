'use client';

import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSection,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface PreviewEnvironmentDialogInput {
  branch: string;
  prNumber: string;
  ttlHours: string;
  databaseStrategy: 'inherit' | 'isolated_clone';
}

interface PreviewEnvironmentDialogProps {
  open: boolean;
  loading: boolean;
  disabled?: boolean;
  disabledSummary?: string;
  allowIsolatedClone: boolean;
  isolatedCloneSummary?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: PreviewEnvironmentDialogInput) => Promise<void>;
}

export function PreviewEnvironmentDialog({
  open,
  loading,
  disabled = false,
  disabledSummary,
  allowIsolatedClone,
  isolatedCloneSummary,
  onOpenChange,
  onSubmit,
}: PreviewEnvironmentDialogProps) {
  const form = useForm({
    defaultValues: {
      branch: '',
      prNumber: '',
      ttlHours: '72',
      databaseStrategy: 'inherit' as 'inherit' | 'isolated_clone',
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
      form.reset();
    },
  });

  const getErrorMessage = (errors: unknown[]): string | null => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" layout="form">
        <DialogHeader chrome>
          <DialogTitle>新建预览环境</DialogTitle>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit().catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : '创建预览环境失败');
            });
          }}
        >
          <DialogBody>
            <FormSection className="space-y-4 px-0 py-0 shadow-none">
              {disabledSummary ? <FormDescription>{disabledSummary}</FormDescription> : null}

              <div className="console-inset rounded-[24px] p-4 sm:p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <form.Field name="branch">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>分支</FormLabel>
                        <Input
                          id={field.name}
                          placeholder="feature/release-intel"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={loading || disabled}
                        />
                        <FormMessage>
                          {field.state.meta.isTouched
                            ? getErrorMessage(field.state.meta.errors)
                            : null}
                        </FormMessage>
                      </FormField>
                    )}
                  </form.Field>
                  <form.Field name="prNumber">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>PR 号</FormLabel>
                        <Input
                          id={field.name}
                          inputMode="numeric"
                          placeholder="42"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={loading || disabled}
                        />
                        <FormMessage>
                          {field.state.meta.isTouched
                            ? getErrorMessage(field.state.meta.errors)
                            : null}
                        </FormMessage>
                      </FormField>
                    )}
                  </form.Field>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <form.Field name="ttlHours">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>保留时长（小时）</FormLabel>
                        <Input
                          id={field.name}
                          inputMode="numeric"
                          placeholder="72"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={loading || disabled}
                        />
                        <FormMessage />
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name="databaseStrategy">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor="preview-database-strategy">数据库策略</FormLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(value: 'inherit' | 'isolated_clone') =>
                            field.handleChange(value)
                          }
                          disabled={loading || disabled}
                        >
                          <SelectTrigger id="preview-database-strategy">
                            <SelectValue placeholder="选择数据库策略" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">继承基础数据库</SelectItem>
                            <SelectItem value="isolated_clone" disabled={!allowIsolatedClone}>
                              独立预览库
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {field.state.value === 'isolated_clone' && isolatedCloneSummary ? (
                          <FormDescription>{isolatedCloneSummary}</FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormField>
                    )}
                  </form.Field>
                </div>
              </div>
            </FormSection>
          </DialogBody>

          <DialogFooter chrome>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <form.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
              {({ isSubmitting }) => (
                <Button
                  type="submit"
                  className="w-full rounded-full sm:w-auto"
                  disabled={loading || disabled || isSubmitting}
                >
                  {loading || isSubmitting ? '启动中...' : '启动预览环境'}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
