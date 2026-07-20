import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

/**
 * 가입 신청 승인/거절.
 * 승인 권한: 해당 공동체의 회장(adminCommunities) 또는 슈퍼관리자.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const { action } = (await req.json().catch(() => ({}))) as {
    action?: 'approve' | 'reject'
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const ref = adminDb.collection('membershipRequests').doc(id)
  const doc = await ref.get()
  if (!doc.exists) {
    return NextResponse.json({ error: '신청을 찾을 수 없어요.' }, { status: 404 })
  }
  const reqData = doc.data()!

  const canDecide =
    user.role === 'superadmin' || user.adminCommunities.includes(reqData.communityId)
  if (!canDecide) {
    return NextResponse.json({ error: '승인 권한이 없습니다.' }, { status: 403 })
  }

  if (reqData.status !== 'pending') {
    return NextResponse.json(
      { error: '이미 처리된 신청입니다.', status: reqData.status },
      { status: 409 }
    )
  }

  await ref.update({
    status: action === 'approve' ? 'approved' : 'rejected',
    decidedAt: FieldValue.serverTimestamp(),
    decidedBy: user.uid,
  })

  if (action === 'approve') {
    await adminDb.collection('users').doc(reqData.uid).update({
      communityIds: FieldValue.arrayUnion(reqData.communityId),
    })

    await createMessageAndBroadcast({
      communityId: reqData.communityId,
      authorUid: reqData.uid,
      authorName: '시스템',
      type: 'system',
      text: `${reqData.displayName}님이 참여했습니다`,
    })
  }

  return NextResponse.json({ ok: true, status: action === 'approve' ? 'approved' : 'rejected' })
}
