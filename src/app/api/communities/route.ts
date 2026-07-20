import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { COMMUNITY_TYPES, SIDO_LIST, SIGUNGU_BY_SIDO } from '@/lib/regions'

export const dynamic = 'force-dynamic'

/** 초대코드 생성 — 혼동하기 쉬운 0/O/1/I는 제외한다. */
function generateInviteCode(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode()
    const dup = await adminDb
      .collection('communities')
      .where('inviteCode', '==', code)
      .limit(1)
      .get()
    if (dup.empty) return code
  }
  // 매우 드문 경우 — 타임스탬프를 붙여 충돌을 피한다.
  return `${generateInviteCode(6)}${Date.now().toString(36).toUpperCase().slice(-3)}`
}

/**
 * 새 마을(공동체) 생성. 슈퍼관리자 전용.
 * 생성자는 해당 마을의 회장이자 첫 회원이 된다.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  // 실제 권한으로 검사한다 — 체험 모드 중에도 의도치 않게 막히지 않도록.
  if (user.realRole !== 'superadmin') {
    return NextResponse.json({ error: '슈퍼관리자만 마을을 만들 수 있습니다.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    communityType?: string
    sido?: string
    sigungu?: string
    eupmyeondong?: string
    description?: string
    lat?: number
    lng?: number
    isPublic?: boolean
  }

  const name = (body.name || '').trim()
  const communityType = (body.communityType || '').trim()
  const sido = (body.sido || '').trim()
  const sigungu = (body.sigungu || '').trim()
  const eupmyeondong = (body.eupmyeondong || '').trim()

  if (!name) return NextResponse.json({ error: '마을 이름을 입력해주세요.' }, { status: 400 })
  if (!COMMUNITY_TYPES.includes(communityType as (typeof COMMUNITY_TYPES)[number])) {
    return NextResponse.json({ error: '모임 종류를 선택해주세요.' }, { status: 400 })
  }
  if (!SIDO_LIST.includes(sido as (typeof SIDO_LIST)[number])) {
    return NextResponse.json({ error: '시/도를 선택해주세요.' }, { status: 400 })
  }
  if (!sigungu || !(SIGUNGU_BY_SIDO[sido] ?? []).includes(sigungu)) {
    return NextResponse.json({ error: '시/군/구를 선택해주세요.' }, { status: 400 })
  }
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: '지도에서 마을 위치를 찍어주세요.' }, { status: 400 })
  }

  const regionName = [sido, sigungu, eupmyeondong].filter(Boolean).join(' ')
  const inviteCode = await uniqueInviteCode()

  const ref = adminDb.collection('communities').doc()
  await ref.set({
    name,
    communityType,
    regionName,
    sido,
    sigungu,
    description: (body.description || '').trim() || null,
    coverImageUrl: null,
    inviteCode,
    isPublic: body.isPublic !== false,
    lat: body.lat,
    lng: body.lng,
    createdBy: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  })

  // 만든 사람을 회장 겸 첫 회원으로 등록한다.
  await adminDb.collection('users').doc(user.uid).update({
    communityIds: FieldValue.arrayUnion(ref.id),
    adminCommunities: FieldValue.arrayUnion(ref.id),
  })

  return NextResponse.json({
    ok: true,
    id: ref.id,
    name,
    inviteCode,
  })
}
