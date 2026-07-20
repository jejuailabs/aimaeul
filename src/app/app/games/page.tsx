import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { GamesClient } from './games-client'

export const dynamic = 'force-dynamic'

export default async function GamesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/games')

  // 참여 중인 마을이 없으면 온보딩으로 유도
  if (user.communities.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="text-5xl">🎮</div>
        <h1 className="text-xl font-bold">참여 중인 마을이 없어요</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          게임은 마을 멤버와 함께 쓸 수 있어요.
          <br />
          먼저 마을에 참여해주세요.
        </p>
        <Link
          href="/onboarding"
          className="mt-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          마을 참여하러 가기
        </Link>
      </div>
    )
  }

  // 각 마을의 멤버를 미리 불러와 참가자 피커에 prefill
  const communitiesWithMembers = await Promise.all(
    user.communities.map(async (c) => {
      const members = await db.communityMember.findMany({
        where: { communityId: c.id },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
      })
      return {
        ...c,
        members: members.map((m) => ({ id: m.user.id, name: m.user.name })),
      }
    })
  )

  return (
    <GamesClient
      communities={communitiesWithMembers}
      defaultCommunityId={communitiesWithMembers[0].id}
    />
  )
}
