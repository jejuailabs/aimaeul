import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

/** 이 마을을 관리할 수 있는지. 슈퍼관리자이거나 해당 마을 회장이어야 한다. */
function canManage(
  user: { realRole: string; realAdminCommunities: string[] },
  communityId: string
) {
  return user.realRole === 'superadmin' || user.realAdminCommunities.includes(communityId)
}

/** 마을 회원 목록. 누가 회장인지 함께 준다. */
export async function GET(
  _req: Request,
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

  const snap = await adminDb
    .collection('users')
    .where('communityIds', 'array-contains', id)
    .get()

  const members = snap.docs.map((d) => {
    const u = d.data()
    return {
      uid: d.id,
      displayName: u.displayName ?? '익명',
      email: u.email ?? null,
      photoURL: u.photoURL ?? null,
      isLeader: (u.adminCommunities ?? []).includes(id),
      isSuperadmin: u.role === 'superadmin',
    }
  })

  members.sort((a, b) => Number(b.isLeader) - Number(a.isLeader))
  return NextResponse.json({ members })
}

/**
 * 회원 관리.
 * - promote: 회장 임명
 * - demote: 회장 해제
 * - remove: 마을에서 내보내기
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
  if (!canManage(user, id)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { uid, action } = (await req.json().catch(() => ({}))) as {
    uid?: string
    action?: 'promote' | 'demote' | 'remove'
  }
  if (!uid || !['promote', 'demote', 'remove'].includes(action ?? '')) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const targetRef = adminDb.collection('users').doc(uid)
  const target = await targetRef.get()
  if (!target.exists) {
    return NextResponse.json({ error: '회원을 찾을 수 없어요.' }, { status: 404 })
  }

  // 회장이 다른 회장을 건드리지 못하게 한다. 슈퍼관리자만 가능.
  const targetIsLeader = (target.data()?.adminCommunities ?? []).includes(id)
  if (targetIsLeader && user.realRole !== 'superadmin') {
    return NextResponse.json(
      { error: '회장 권한 변경은 운영자만 할 수 있어요.' },
      { status: 403 }
    )
  }

  if (action === 'promote') {
    await targetRef.update({ adminCommunities: FieldValue.arrayUnion(id) })
  } else if (action === 'demote') {
    await targetRef.update({ adminCommunities: FieldValue.arrayRemove(id) })
  } else {
    // 내보내면 회장 권한도 함께 거둔다.
    await targetRef.update({
      communityIds: FieldValue.arrayRemove(id),
      adminCommunities: FieldValue.arrayRemove(id),
    })
  }

  return NextResponse.json({ ok: true, uid, action })
}
