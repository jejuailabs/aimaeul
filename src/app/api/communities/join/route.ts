import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { communityId, inviteCode } = body as {
    communityId?: string
    inviteCode?: string
  }

  let communityDoc = null as FirebaseFirestore.DocumentSnapshot | null
  if (inviteCode) {
    const snap = await adminDb
      .collection('communities')
      .where('inviteCode', '==', inviteCode.trim().toUpperCase())
      .limit(1)
      .get()
    communityDoc = snap.docs[0] ?? null
  } else if (communityId) {
    const doc = await adminDb.collection('communities').doc(communityId).get()
    if (doc.exists) communityDoc = doc
  }

  if (!communityDoc || !communityDoc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }

  const community = communityDoc.data()!
  const cId = communityDoc.id

  if (!community.isPublic && !inviteCode) {
    return NextResponse.json(
      { error: '비공개 마을입니다. 초대코드를 입력해주세요.' },
      { status: 403 }
    )
  }

  const userDoc = await adminDb.collection('users').doc(user.uid).get()
  const userData = userDoc.data() || {}
  const existingIds: string[] = userData.communityIds || []

  if (existingIds.includes(cId)) {
    return NextResponse.json({ ok: true, communityId: cId, already: true })
  }

  await adminDb.collection('users').doc(user.uid).update({
    communityIds: FieldValue.arrayUnion(cId),
  })

  await createMessageAndBroadcast({
    communityId: cId,
    authorUid: user.uid,
    authorName: '시스템',
    type: 'system',
    text: `${user.displayName}님이 참여했습니다`,
  })

  return NextResponse.json({ ok: true, communityId: cId })
}
