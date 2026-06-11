import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

export function FormActionBar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('flex flex-wrap justify-end gap-3', className)}>{children}</div>;
}

export function FormActionButton({ className, ...props }: ButtonProps) {
  return <Button className={cn('h-9 px-4', className)} {...props} />;
}
