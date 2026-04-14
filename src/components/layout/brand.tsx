import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

interface BrandLockupProps {
  href?: string;
  size?: number;
  subtitle?: string;
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  priority?: boolean;
}

export function BrandMark({ size = 40, className, priority = false }: BrandMarkProps) {
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card',
        className
      )}
      style={{ height: size, width: size }}
    >
      <Image
        src="/juanie-logo.png"
        alt="Juanie logo"
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export function BrandLockup({
  href,
  size = 40,
  subtitle,
  className,
  markClassName,
  nameClassName,
  subtitleClassName,
  priority = false,
}: BrandLockupProps) {
  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark size={size} className={markClassName} priority={priority} />
      <div className="min-w-0">
        <div className={cn('text-sm font-medium', nameClassName)}>Juanie</div>
        {subtitle ? (
          <div className={cn('text-xs text-muted-foreground', subtitleClassName)}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}
