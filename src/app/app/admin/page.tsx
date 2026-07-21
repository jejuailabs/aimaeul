import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Building2,
  ChevronRight,
  Clock,
  MapPin,
  PlusCircle,
  UserCheck,
  Users,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { CommunityBadge } from '@/components/community-badge'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { AdminApprovalPanel } from './admin-approval-panel'

export const dynamic = 'force-dynamic'

type CommunityRow = {
  id: string
  name: string
  communityType: string
  regionName: string
  memberCount: number
  pendingCount: number
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/admin')

  // 체험 모드로 권한을 낮춘 상태면 대시보드를 감춘다.
  if (user.role !== 'superadmin') {
    return (
      <AppShell title="운영자 대시보드">
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          <p>운영자만 볼 수 있는 화면이에요.</p>
          {user.realRole === 'superadmin' && (
            <p className="mt-2">
              지금 체험 모드가 켜져 있어요. 상단 배지를 눌러 슈퍼관리자로 되돌리면 보입니다.
            </p>
          )}
        </div>
      </AppShell>
    )
  }

  const [commSnap, userCount, pendingSnap] = await Promise.all([
    adminDb.collection('communities').get(),
    adminDb.collection('users').count().get(),
    adminDb.collection('membershipRequests').where('status', '==', 'pending').get(),
  ])

  // 마을별 대기 건수를 미리 집계해 어디를 봐야 하는지 바로 드러나게 한다.
  const pendingByCommunity = new Map<string, number>()
  for (const d of pendingSnap.docs) {
    const cid = d.data().communityId
    pendingByCommunity.set(cid, (pendingByCommunity.get(cid) ?? 0) + 1)
  }

  const communities: CommunityRow[] = await Promise.all(
    commSnap.docs.map(async (doc) => {
      const c = doc.data()
      const members = await adminDb
        .collection('users')
        .where('communityIds', 'array-contains', doc.id)
        .count()
        .get()
      return {
        id: doc.id,
        name: c.name ?? '',
        communityType: c.communityType ?? '',
        regionName: c.regionName ?? '',
        memberCount: members.data().count,
        pendingCount: pendingByCommunity.get(doc.id) ?? 0,
      }
    })
  )

  communities.sort((a, b) => b.pendingCount - a.pendingCount || a.name.localeCompare(b.name))

  const stats = [
    { label: '승인 대기', value: pendingSnap.size, icon: Clock, accent: pendingSnap.size > 0 },
    { label: '마을', value: commSnap.size, icon: Building2, accent: false },
    { label: '전체 회원', value: userCount.data().count, icon: Users, accent: false },
  ]

  return (
    <AppShell title="운영자 대시보드">
      <div className="space-y-5 px-3 py-3">
        {/* 요약 */}
        <section className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border p-3 text-center ${
                s.accent ? 'border-primary/50 bg-primary/10' : 'border-border bg-card'
              }`}
            >
              <s.icon
                className={`mx-auto mb-1 h-4 w-4 ${
                  s.accent ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <p className="text-xl font-black tabular-nums">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        {/* 가입 승인 — 전체 마을 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <UserCheck className="h-4 w-4 text-primary" /> 가입 승인 대기
            </h2>
            <Link
              href="/app/admin/members"
              className="text-xs text-muted-foreground hover:underline"
            >
              전체 내역 →
            </Link>
          </div>
          <AdminApprovalPanel />
        </section>

        {/* 마을 목록 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <Building2 className="h-4 w-4 text-primary" /> 마을 관리
            </h2>
            <Link
              href="/app/admin/communities/new"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <PlusCircle className="h-3.5 w-3.5" /> 새 마을
            </Link>
          </div>
          <div className="space-y-2">
            {communities.map((c) => (
              <Link
                key={c.id}
                href={`/village/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.name}</span>
                    <CommunityBadge type={c.communityType} size="sm" />
                    {c.pendingCount > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        대기 {c.pendingCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {c.regionName}
                    <span className="mx-1">·</span>
                    <Users className="h-3 w-3" /> {c.memberCount}명
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
