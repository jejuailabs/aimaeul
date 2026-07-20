import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/reports  { communityId, description, photoUrl? }
// 제보 생성 — 회원 + 멤버십 필요. status "접수".
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, description, photoUrl } = body as {
    communityId?: string
    description?: string
    photoUrl?: string | null
  }

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }
  const desc = (description ?? '').trim()
  if (!desc) {
    return NextResponse.json({ error: '상황 설명을 입력해주세요.' }, { status: 400 })
  }
  if (desc.length > 1000) {
    return NextResponse.json({ error: '설명은 1000자 이내로 입력해주세요.' }, { status: 400 })
  }

  // 멤버십 검증
  const member = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
  })
  if (!member) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  // photoUrl이 있으면 해당 사진의 EXIF도 함께 보존 (report.exifRaw)
  let exifRaw = '{}'
  if (photoUrl) {
    const photo = await db.photo.findFirst({
      where: { storageUrl: photoUrl, communityId },
      select: { exifRaw: true },
    })
    if (photo?.exifRaw) exifRaw = photo.exifRaw
  }

  const report = await db.report.create({
    data: {
      communityId,
      reporterId: user.id,
      description: desc,
      photoUrl: photoUrl ?? null,
      exifRaw,
      status: '접수',
    },
  })

  return NextResponse.json({ ok: true, report })
}

// GET /api/reports — 내 제보 내역 (본인이 올린 것만)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const reports = await db.report.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      community: {
        select: { id: true, name: true, regionName: true, communityType: true },
      },
    },
    take: 100,
  })

  return NextResponse.json({ reports })
}
