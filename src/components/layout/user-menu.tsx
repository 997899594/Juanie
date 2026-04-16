'use client';

import { ChevronsUpDown, LogOut, User } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function UserMenu({ variant = 'compact' }: { variant?: 'compact' | 'sidebar' }) {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const initials = session.user.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'sidebar' ? (
          <Button
            variant="ghost"
            className="h-auto w-full justify-between rounded-[20px] px-3 py-3 hover:bg-secondary/70"
          >
            <span className="flex min-w-0 items-center gap-3 text-left">
              <Avatar className="h-9 w-9">
                <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ''} />
                <AvatarFallback className="bg-muted text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{session.user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {session.user.email}
                </span>
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        ) : (
          <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ''} />
              <AvatarFallback className="bg-muted text-[10px]">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === 'sidebar' ? 'start' : 'end'}
        className={cn('w-48', variant === 'sidebar' && 'w-56')}
      >
        <div className="flex items-center gap-2 p-2">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings" className="cursor-pointer text-sm">
            <User className="mr-2 h-3.5 w-3.5" />
            个人设置
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm text-destructive focus:text-destructive"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
