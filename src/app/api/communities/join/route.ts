import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

// POST /api/communities/join  { communityId } 또는 { inviteCode }
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

  let community = null as null | { id: string; name: string; isPublic: boolean; inviteCode: string }
  if (inviteCode) {
    community = await db.community.findFirst({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
      select: { id: true, name: true, isPublic: true, inviteCode: true },
    })
  } else if (communityId) {
    community = await db.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, isPublic: true, inviteCode: true },
    })
  }

  if (!community) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }

  // 비공개 커뮤니티는 초대코드 필수
  if (!community.isPublic && !inviteCode) {
    return NextResponse.json(
      { error: '비공개 마을입니다. 초대코드를 입력해주세요.' },
      { status: 403 }
    )
  }

  // 이미 가입했는지 확인
  const existing = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: user.id } },
  })
  if (existing) {
    return NextResponse.json({ ok: true, communityId: community.id, already: true })
  }

  await db.communityMember.create({
    data: { communityId: community.id, userId: user.id },
  })

  // 시스템 메시지: "OO님이 참여했습니다"
  await createMessageAndBroadcast({
    communityId: community.id,
    authorId: user.id,
    authorName: '시스템',
    type: 'system',
    text: `${user.name}님이 참여했습니다`,
  })

  return NextResponse.json({ ok: true, communityId: community.id })
}
