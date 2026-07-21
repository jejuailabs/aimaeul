import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

/** 하위 문서를 나눠서 지운다. 한 번에 많은 문서를 지우면 타임아웃이 난다. */
async function deleteCollection(ref: FirebaseFirestore.CollectionReference) {
  const BATCH = 300
  for (;;) {
    const snap = await ref.limit(BATCH).get()
    if (snap.empty) return
    const batch = adminDb.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    if (snap.size < BATCH) return
  }
}

/**
 * 마을 삭제. 슈퍼관리자 전용.
 *
 * 채팅·사진·행사·빈집·소식 등 딸린 자료와 회원들의 소속까지 함께 정리한다.
 * 남겨두면 지워진 마을이 목록·피드에 유령처럼 남는다.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (user.realRole !== 'superadmin') {
    return NextResponse.json({ error: '운영자만 마을을 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { id } = await params
  const ref = adminDb.collection('communities').doc(id)
  const doc = await ref.get()
  if (!doc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }
  const name = doc.data()?.name ?? ''

  // 1) 서브컬렉션(메시지·사진)
  await deleteCollection(ref.collection('messages'))
  await deleteCollection(ref.collection('photos'))

  // 2) 저장된 사진 파일
  await adminStorage
    .bucket()
    .deleteFiles({ prefix: `photos/${id}/` })
    .catch(() => {})

  // 3) 이 마을을 참조하는 최상위 문서들
  for (const col of ['events', 'vacantHouses', 'dailyDigests', 'monthlyDigests', 'villageHistory', 'membershipRequests']) {
    const snap = await adminDb.collection(col).where('communityId', '==', id).get()
    for (let i = 0; i < snap.docs.length; i += 300) {
      const batch = adminDb.batch()
      snap.docs.slice(i, i + 300).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }

  // 4) 회원들의 소속·회장 권한에서 제거
  const memberSnap = await adminDb
    .collection('users')
    .where('communityIds', 'array-contains', id)
    .get()
  for (const m of memberSnap.docs) {
    await m.ref.update({
      communityIds: FieldValue.arrayRemove(id),
      adminCommunities: FieldValue.arrayRemove(id),
    })
  }

  await ref.delete()

  return NextResponse.json({ ok: true, deleted: id, name })
}
