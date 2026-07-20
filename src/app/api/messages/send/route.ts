import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

// POST /api/messages/send
// { communityId, type?, text?, photoId?, emojiUrl?, gameResultPayload? }
// 채팅 메시지를 Firestore에 저장하고 브로드캐스트
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, type, text, photoId, emojiUrl, gameResultPayload } = body as {
    communityId?: string
    type?: string
    text?: string | null
    photoId?: string | null
    emojiUrl?: string | null
    gameResultPayload?: any | null
  }

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }

  // 멤버십 검증
  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const msg = await createMessageAndBroadcast({
    communityId,
    authorUid: user.uid,
    authorName: user.displayName,
    authorPhotoURL: user.photoURL,
    type: type ?? 'text',
    text: text ?? null,
    photoId: photoId ?? null,
    emojiUrl: emojiUrl ?? null,
    gameResultPayload: gameResultPayload ?? null,
  })

  return NextResponse.json({ ok: true, message: msg })
}
