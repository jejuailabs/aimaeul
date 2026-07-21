import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

function canManage(
  user: { realRole: string; realAdminCommunities: string[] },
  communityId: string
) {
  return user.realRole === 'superadmin' || user.realAdminCommunities.includes(communityId)
}

/** 마을의 최근 게시물(사진·대화)을 관리용으로 불러온다. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params
  if (!canManage(user, id)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const kind = new URL(req.url).searchParams.get('kind') ?? 'photo'
  const ref = adminDb.collection('communities').doc(id)

  if (kind === 'photo') {
    const snap = await ref.collection('photos').orderBy('createdAt', 'desc').limit(60).get()
    return NextResponse.json({
      items: snap.docs.map((d) => {
        const p = d.data()
        return {
          id: d.id,
          kind: 'photo' as const,
          thumbnailUrl: p.thumbnailUrl ?? p.storageUrl ?? null,
          authorName: p.uploaderName ?? '익명',
          text: p.aiCaption ?? null,
          createdAt: p.createdAt?.toDate?.()?.toISOString() ?? null,
        }
      }),
    })
  }

  const snap = await ref.collection('messages').orderBy('createdAt', 'desc').limit(80).get()
  return NextResponse.json({
    items: snap.docs
      .filter((d) => d.data().type !== 'system')
      .map((d) => {
        const m = d.data()
        return {
          id: d.id,
          kind: 'message' as const,
          thumbnailUrl: null,
          authorName: m.authorName ?? '익명',
          text: m.text ?? (m.type === 'photo' ? '📷 사진' : m.type),
          createdAt: m.createdAt?.toDate?.()?.toISOString() ?? null,
        }
      }),
  })
}

/** 게시물 삭제. 사진은 저장된 파일과 연결된 메시지까지 함께 정리한다. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params
  if (!canManage(user, id)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { itemId, kind } = (await req.json().catch(() => ({}))) as {
    itemId?: string
    kind?: 'photo' | 'message'
  }
  if (!itemId || (kind !== 'photo' && kind !== 'message')) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const ref = adminDb.collection('communities').doc(id)

  if (kind === 'message') {
    await ref.collection('messages').doc(itemId).delete()
    return NextResponse.json({ ok: true })
  }

  // 사진: 파일 + 문서 + 이 사진을 가리키는 메시지까지 지운다.
  await adminStorage.bucket().file(`photos/${id}/${itemId}.jpg`).delete().catch(() => {})
  await adminStorage.bucket().file(`photos/${id}/${itemId}_thumb.jpg`).delete().catch(() => {})
  await ref.collection('photos').doc(itemId).delete()

  const linked = await ref.collection('messages').where('photoId', '==', itemId).get()
  await Promise.all(linked.docs.map((d) => d.ref.delete()))

  return NextResponse.json({ ok: true })
}
