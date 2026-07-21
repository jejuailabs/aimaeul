'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Plus, MapPin, Megaphone, Building2, Smile, ChevronRight, UserCheck, PlusCircle, LayoutDashboard } from 'lucide-react'
import { ViewModeSwitcher } from '@/components/view-mode-switcher'
import { AppShell } from '@/components/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { CommunityBadge } from '@/components/community-badge'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

export default function MePage() {
  const router = useRouter()
  const { user, communities, signOut } = useAuth()
  // 체험 모드가 반영된 권한은 서버만 알고 있으므로 API로 받아온다.
  const [canManageMembers, setCanManageMembers] = useState(false)
  const [isSuperadmin, setIsSuperadmin] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/view-mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setCanManageMembers(!!d.canManageMembers)
        setIsSuperadmin(d.role === 'superadmin')
      })
      .catch(() => {})
  }, [user])

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut()
    toast.success('로그아웃했어요.')
    router.push('/')
    router.refresh()
  }

  if (!user) {
    return (
      <AppShell title="내 정보">
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center text-sm text-muted-foreground">
          <p>로그인이 필요해요.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link href="/login">로그인하기</Link>
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="내 정보">
      <div className="px-4 py-4">
        {/* Profile card */}
        <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <Avatar className="h-16 w-16 rounded-2xl">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName} />
            <AvatarFallback className="rounded-2xl bg-primary/20 text-xl font-bold">
              {user.displayName?.slice(0, 1) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{user.displayName}</h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Communities */}
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">참여 중인 마을</h3>
          {communities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              참여 중인 마을이 없어요.
            </div>
          ) : (
            <div className="space-y-2">
              {communities.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/chat/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{c.name}</p>
                      <CommunityBadge type={c.communityType} size="sm" />
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {c.regionName}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Settings & Actions */}
        <section className="mt-5 space-y-2">
          <h3 className="mb-2 text-sm font-semibold">설정</h3>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
            <span className="text-sm font-medium">다크 / 라이트 모드</span>
            <ThemeToggle />
          </div>

          <Link
            href="/onboarding"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">새 마을 참여하기</span>
          </Link>

          <Link
            href="/app/report"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">제보하기</span>
          </Link>

          <Link
            href="/app/vacant-houses"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">빈집소개</span>
          </Link>

          <ViewModeSwitcher />

          {isSuperadmin && (
            <Link
              href="/app/admin"
              className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
            >
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">운영자 대시보드</span>
            </Link>
          )}

          {isSuperadmin && (
            <Link
              href="/app/admin/communities/new"
              className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
            >
              <PlusCircle className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">새 마을 만들기</span>
            </Link>
          )}

          {canManageMembers && (
            <Link
              href="/app/admin/members"
              className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
            >
              <UserCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">가입 승인 관리</span>
            </Link>
          )}

          <Link
            href="/app/emoji-packs"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">이모티콘 팩 관리</span>
          </Link>
        </section>

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="mt-6 w-full rounded-xl"
          size="lg"
        >
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </AppShell>
  )
}
