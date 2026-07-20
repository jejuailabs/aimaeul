import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

/**
 * 전국 마을 공용 채팅방("마을 광장").
 *
 * 마을 단위 채팅과 달리 모두가 함께 쓰므로, 누가 어느 마을 사람인지
 * 반드시 함께 저장한다. 소속 마을이 없으면 글을 쓸 수 없다.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (user.communities.length === 0) {
    return NextResponse.json(
      { error: '마을에 참여한 뒤에 이용할 수 있어요.' },
      { status: 403 }
    )
  }

  const { text, communityId } = (await req.json().catch(() => ({}))) as {
    text?: string
    communityId?: string
  }

  const body = (text || '').trim()
  if (!body) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }
  if (body.length > 1000) {
    return NextResponse.json({ error: '1000자를 넘을 수 없어요.' }, { status: 400 })
  }

  // 여러 마을에 속한 경우 어느 마을 사람으로 말할지 고른다. 기본은 첫 마을.
  const speaking =
    user.communities.find((c) => c.id === communityId) ?? user.communities[0]

  const ref = adminDb.collection('townSquareMessages').doc()
  await ref.set({
    messageId: ref.id,
    authorUid: user.uid,
    authorName: user.displayName,
    authorPhotoURL: user.photoURL,
    communityId: speaking.id,
    communityName: speaking.name,
    communityType: speaking.communityType,
    regionName: speaking.regionName,
    text: body,
    createdAt: FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ ok: true, id: ref.id })
}
