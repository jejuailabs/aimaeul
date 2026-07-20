import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

/**
 * 가입 신청 생성.
 *
 * 신청만으로는 소속되지 않는다. 회장 또는 슈퍼관리자가 승인해야
 * `users.communityIds`에 반영되고 그때부터 채팅에 들어갈 수 있다.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { communityId, message } = (await req.json().catch(() => ({}))) as {
    communityId?: string
    message?: string
  }
  if (!communityId) {
    return NextResponse.json({ error: '마을을 선택해주세요.' }, { status: 400 })
  }

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }
  const community = commDoc.data()!

  if (user.communities.some((c) => c.id === communityId)) {
    return NextResponse.json({ error: '이미 참여 중인 마을이에요.', already: true }, { status: 409 })
  }

  // 슈퍼관리자는 어차피 본인이 승인 권한을 갖는다.
  // 승인을 기다리게 하면 자기 신청을 자기가 승인해야 하는 이상한 흐름이 되므로
  // 즉시 참여시키고 이력만 남긴다(체험 목적).
  if (user.realRole === 'superadmin') {
    await adminDb.collection('users').doc(user.uid).update({
      communityIds: FieldValue.arrayUnion(communityId),
    })

    const ref = adminDb.collection('membershipRequests').doc()
    await ref.set({
      requestId: ref.id,
      communityId,
      communityName: community.name,
      communityType: community.communityType,
      regionName: community.regionName,
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
      message: null,
      source: 'superadmin',
      status: 'approved',
      createdAt: FieldValue.serverTimestamp(),
      decidedAt: FieldValue.serverTimestamp(),
      decidedBy: user.uid,
    })

    return NextResponse.json({ ok: true, approved: true, communityId, id: ref.id })
  }

  // 같은 마을에 대기 중인 신청이 있으면 중복 생성하지 않는다.
  const dup = await adminDb
    .collection('membershipRequests')
    .where('uid', '==', user.uid)
    .where('communityId', '==', communityId)
    .where('status', '==', 'pending')
    .limit(1)
    .get()
  if (!dup.empty) {
    return NextResponse.json({ ok: true, pending: true, id: dup.docs[0].id })
  }

  const ref = adminDb.collection('membershipRequests').doc()
  await ref.set({
    requestId: ref.id,
    communityId,
    communityName: community.name,
    communityType: community.communityType,
    regionName: community.regionName,
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
    message: (message || '').slice(0, 300) || null,
    source: 'search',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    decidedAt: null,
    decidedBy: null,
  })

  return NextResponse.json({ ok: true, pending: true, id: ref.id })
}

/**
 * 승인 대기 목록 조회.
 * - 슈퍼관리자: 전체
 * - 회장: 본인이 관리하는 공동체만
 * - 그 외: 본인이 낸 신청만
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'
  const scope = searchParams.get('scope') || 'mine'

  let query = adminDb
    .collection('membershipRequests')
    .where('status', '==', status) as FirebaseFirestore.Query

  if (scope === 'manage') {
    if (user.role === 'superadmin') {
      // 전체 조회 — 추가 필터 없음
    } else if (user.adminCommunities.length > 0) {
      // Firestore in 연산자는 최대 30개까지만 허용한다.
      query = query.where('communityId', 'in', user.adminCommunities.slice(0, 30))
    } else {
      return NextResponse.json({ requests: [] })
    }
  } else {
    query = query.where('uid', '==', user.uid)
  }

  const snap = await query.orderBy('createdAt', 'desc').limit(200).get()

  return NextResponse.json({
    requests: snap.docs.map((d) => {
      const r = d.data()
      return {
        id: d.id,
        communityId: r.communityId,
        communityName: r.communityName,
        communityType: r.communityType,
        regionName: r.regionName,
        uid: r.uid,
        displayName: r.displayName,
        photoURL: r.photoURL,
        email: r.email,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt?.toDate?.()?.toISOString() ?? null,
      }
    }),
  })
}
