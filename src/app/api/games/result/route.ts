import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { communityId, gameType, title, resultSummary, winner } = body as {
    communityId?: string
    gameType?: string
    title?: string
    resultSummary?: string
    winner?: string | null
  }

  if (!communityId || !gameType || !title || !resultSummary) {
    return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
  }

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const msg = await createMessageAndBroadcast({
    communityId,
    authorUid: user.uid,
    authorName: user.displayName,
    authorPhotoURL: user.photoURL,
    type: 'game_result',
    gameResultPayload: {
      gameType,
      title,
      resultSummary,
      winner: winner ?? null,
    },
  })

  return NextResponse.json({ ok: true, messageId: msg.id })
}
