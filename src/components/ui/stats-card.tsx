import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, description, icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </p>
            )}
          </div>
          {icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
