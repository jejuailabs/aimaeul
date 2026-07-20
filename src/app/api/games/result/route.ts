import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

// POST /api/games/result
// { communityId, gameType, title, resultSummary, winner? }
// 게임 결과를 messages 컬렉션에 game_result 타입으로 저장 + 브로드캐스트
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

  // 멤버십 검증
  const member = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
  })
  if (!member) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const msg = await createMessageAndBroadcast({
    communityId,
    authorId: user.id,
    authorName: user.name,
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
