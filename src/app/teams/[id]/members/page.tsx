'use client';

import { Check, Copy, Link, Plus, Trash2, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamMember {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Invitation {
  id: string;
  role: string;
  expires: string;
  createdAt: string;
}

export default function TeamMembersPage() {
  const params = useParams();
  const teamId = params.id as string;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);

  // Invite link state
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkRole, setLinkRole] = useState('member');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [fetchMembers, fetchInvitations]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.ok) {
        setIsOpen(false);
        setInviteEmail('');
        setInviteRole('member');
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/members/${deleteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to change role:', error);
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    setGeneratedLink(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: linkRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedLink(data.inviteUrl);
        fetchInvitations();
      }
    } catch (error) {
      console.error('Failed to generate invite link:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeInvitation = async (invId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations/${invId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchInvitations();
      }
    } catch (error) {
      console.error('Failed to revoke invitation:', error);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name)
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    return email[0].toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[20px] bg-muted" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[20px] bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: '成员', value: members.length.toString() },
    { label: '待处理邀请', value: invitations.length.toString() },
    { label: '角色', value: '拥有者 / 管理员 / 成员' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="成员"
        description={`${members.length} 名成员${invitations.length > 0 ? ` · ${invitations.length} 个待处理邀请` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Dialog
              open={isLinkDialogOpen}
              onOpenChange={(open) => {
                setIsLinkDialogOpen(open);
                if (!open) {
                  setGeneratedLink(null);
                  setLinkRole('member');
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 rounded-xl px-4">
                  <Link className="h-4 w-4" />
                  邀请链接
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>生成邀请链接</DialogTitle>
                  <DialogDescription>生成一个可分享的入组链接。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm">新成员角色</Label>
                    <Select value={linkRole} onValueChange={setLinkRole}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="member">成员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {generatedLink && (
                    <div className="space-y-2">
                      <Label className="text-sm">邀请链接</Label>
                      <div className="flex gap-2">
                        <Input value={generatedLink} readOnly className="h-11 rounded-xl text-xs" />
                        <Button className="h-11 shrink-0 rounded-xl px-4" onClick={handleCopyLink}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setIsLinkDialogOpen(false)}
                  >
                    关闭
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                  >
                    {generatingLink ? '生成中...' : generatedLink ? '重新生成' : '生成'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-xl px-4">
                  <Plus className="h-4 w-4" />
                  邀请成员
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>邀请成员</DialogTitle>
                    <DialogDescription>输入邮箱地址后发送邀请。</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">
                        邮箱
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">角色</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">管理员</SelectItem>
                          <SelectItem value="member">成员</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setIsOpen(false)}
                    >
                      取消
                    </Button>
                    <Button type="submit" className="rounded-xl" disabled={submitting}>
                      {submitting ? '邀请中...' : '发送邀请'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {members.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有成员</h2>
          <p className="mt-2 text-sm text-muted-foreground">邀请成员后开始协作</p>
          <Button className="mt-5 rounded-xl" onClick={() => setIsOpen(true)}>
            <Plus className="h-4 w-4" />
            邀请成员
          </Button>
        </div>
      ) : (
        <div className="console-panel overflow-hidden px-0 py-0">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-xl">
                  <AvatarImage src={member.user.image ?? undefined} />
                  <AvatarFallback className="rounded-xl bg-secondary text-xs font-semibold">
                    {getInitials(member.user.name, member.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {member.user.name || member.user.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{member.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={member.role}
                  onValueChange={(value) => handleChangeRole(member.id, value)}
                  disabled={member.role === 'owner'}
                >
                  <SelectTrigger className="h-9 w-28 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner" disabled>
                      拥有者
                    </SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="member">成员</SelectItem>
                  </SelectContent>
                </Select>

                {member.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 rounded-xl p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending invite links */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">待处理邀请链接</div>
          <div className="console-panel overflow-hidden px-0 py-0">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 last:border-b-0"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold capitalize">{inv.role}</p>
                  <p className="text-xs text-muted-foreground">
                    到期于 {new Date(inv.expires).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-xl p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRevokeInvitation(inv.id)}
                  title="撤销邀请"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除成员</AlertDialogTitle>
            <AlertDialogDescription>确认将该成员移出团队？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
