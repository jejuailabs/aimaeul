import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageCircle, Plus, Users, MapPin } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CommunityBadge } from '@/components/community-badge'
import { relativeTime, communityTypeMeta } from '@/lib/village'
import { ThemeToggle } from '@/components/theme-toggle'

export const dynamic = 'force-dynamic'

export default async function ChatListPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/chat')
  if (user.communities.length === 0) redirect('/onboarding')

  // 각 커뮤니티의 최근 메시지 1개 + 멤버 수
  const memberships = await db.communityMember.findMany({
    where: { userId: user.id },
    include: {
      community: {
        include: {
          _count: { select: { members: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const rooms = memberships.map((m) => ({
    id: m.community.id,
    name: m.community.name,
    communityType: m.community.communityType,
    regionName: m.community.regionName,
    coverImageUrl: m.community.coverImageUrl,
    memberCount: m.community._count.members,
    lastMessage: m.community.messages[0] ?? null,
  }))

  return (
    <AppShell
      title="채팅"
      right={
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/onboarding" aria-label="새 마을 참여">
            <Plus className="h-5 w-5" />
          </Link>
        </Button>
      }
    >
      <div className="px-2 py-2">
        {rooms.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            참여 중인 마을이 없어요.
          </div>
        )}
        <ul className="divide-y divide-border">
          {rooms.map((r) => {
            const meta = communityTypeMeta(r.communityType)
            const last = r.lastMessage
            let preview = '대화를 시작해보세요'
            if (last) {
              if (last.type === 'system') preview = last.text || ''
              else if (last.type === 'photo') preview = '📷 사진'
              else if (last.type === 'emoji') preview = '이모티콘'
              else if (last.type === 'game_result') {
                const p = last.gameResultPayload && last.gameResultPayload !== 'null'
                  ? JSON.parse(last.gameResultPayload)
                  : null
                preview = `🎲 ${p?.title || '게임 결과'}`
              } else preview = last.text || ''
            }
            return (
              <li key={r.id}>
                <Link
                  href={`/app/chat/${r.id}`}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12 rounded-2xl">
                      <AvatarImage src={r.coverImageUrl || undefined} alt={r.name} />
                      <AvatarFallback
                        className="rounded-2xl text-lg"
                        style={{ backgroundColor: meta.color + '33' }}
                      >
                        {meta.emoji}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px]"
                      aria-hidden
                    >
                      {meta.emoji}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate font-semibold">{r.name}</h3>
                        <CommunityBadge type={r.communityType} size="sm" />
                      </div>
                      {last && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {relativeTime(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-sm text-muted-foreground">{preview}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="h-3 w-3" /> {r.memberCount}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" /> {r.regionName}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 px-4">
          <Link
            href="/onboarding"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <MessageCircle className="h-4 w-4" /> 새 마을 참여하기
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
