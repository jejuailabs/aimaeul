import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { GamesClient } from './games-client'

export const dynamic = 'force-dynamic'

export default async function GamesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/games')

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

  const communitiesWithMembers = await Promise.all(
    user.communities.map(async (c) => {
      const usersSnap = await adminDb
        .collection('users')
        .where('communityIds', 'array-contains', c.id)
        .get()
      const members = usersSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().displayName || '익명',
      }))
      return { ...c, members }
    })
  )

  return (
    <GamesClient
      communities={communitiesWithMembers}
      defaultCommunityId={communitiesWithMembers[0].id}
    />
  )
}
