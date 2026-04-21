'use client';

import { useForm } from '@tanstack/react-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSection,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

const createTeamSchema = z.object({
  name: z.string().trim().min(1, '请输入团队名称'),
  slug: z
    .string()
    .trim()
    .min(1, '请输入标识')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '只支持小写字母、数字和中划线'),
});

type CreateTeamFormValues = z.infer<typeof createTeamSchema>;

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function NewTeamPage() {
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      name: '',
      slug: '',
    } satisfies CreateTeamFormValues,
    validators: {
      onSubmit: createTeamSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '创建团队失败');
      }

      toast.success('团队已创建');
      router.push(`/teams/${data.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="新建团队"
        actions={
          <Button asChild variant="ghost" className="h-9 rounded-full px-4">
            <Link href="/teams">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit().catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : '创建团队失败');
          });
        }}
      >
        <FormSection className="space-y-5">
          <div className="space-y-4">
            <form.Field
              name="name"
              validators={{
                onChange: createTeamSchema.shape.name,
              }}
            >
              {(field) => (
                <FormField>
                  <FormLabel htmlFor={field.name}>团队名称</FormLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      field.handleChange(nextName);
                      form.setFieldValue('slug', generateSlug(nextName));
                    }}
                    placeholder="我的团队"
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  <FormMessage>
                    {field.state.meta.isTouched ? getErrorMessage(field.state.meta.errors) : null}
                  </FormMessage>
                </FormField>
              )}
            </form.Field>

            <form.Field
              name="slug"
              validators={{
                onChange: createTeamSchema.shape.slug,
              }}
            >
              {(field) => (
                <FormField>
                  <FormLabel htmlFor={field.name}>标识</FormLabel>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">@</span>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="my-team"
                      className="flex-1"
                      aria-invalid={field.state.meta.errors.length > 0}
                    />
                  </div>
                  <FormDescription>用于 URL 与命名空间前缀。</FormDescription>
                  <FormMessage>
                    {field.state.meta.isTouched ? getErrorMessage(field.state.meta.errors) : null}
                  </FormMessage>
                </FormField>
              )}
            </form.Field>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/teams">
              <Button type="button" variant="ghost" className="h-9 rounded-full px-4">
                取消
              </Button>
            </Link>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" className="h-9 rounded-full px-4" disabled={!canSubmit}>
                  {isSubmitting ? '创建中...' : '创建团队'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </FormSection>
      </form>
    </div>
  );
}
