import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['게시중', '거래완료', '게시중지'])

// GET /api/vacant-houses/[id] — 단일 매물 (공개 커뮤니티이거나 본인이 멤버인 경우만)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const listing = await db.vacantHouse.findUnique({
    where: { id },
    include: {
      community: {
        select: {
          id: true,
          name: true,
          regionName: true,
          communityType: true,
          isPublic: true,
        },
      },
      poster: { select: { id: true, name: true } },
    },
  })

  if (!listing) {
    return NextResponse.json({ error: '매물을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 비공개 커뮤니티인 경우 멤버 검증
  if (!listing.community.isPublic) {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 401 })
    }
    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: listing.communityId,
          userId: user.id,
        },
      },
    })
    if (!member) {
      return NextResponse.json({ error: '열람 권한이 없습니다.' }, { status: 403 })
    }
  }

  return NextResponse.json({ listing })
}

// PATCH /api/vacant-houses/[id] — 등록자 본인만 수정 (status / 필드 부분 업데이트)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params

  const listing = await db.vacantHouse.findUnique({
    where: { id },
    select: { id: true, posterId: true, communityId: true },
  })
  if (!listing) {
    return NextResponse.json({ error: '매물을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (listing.posterId !== user.id) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    status,
    monthlyRent,
    deposit,
    description,
    photos,
    lat,
    lng,
  } = body as {
    status?: string
    monthlyRent?: number | null
    deposit?: number | null
    description?: string | null
    photos?: string[]
    lat?: number | null
    lng?: number | null
  }

  const data: Record<string, unknown> = {}

  if (status !== undefined) {
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      )
    }
    data.status = status
  }
  if (monthlyRent !== undefined) {
    data.monthlyRent =
      typeof monthlyRent === 'number' && !Number.isNaN(monthlyRent)
        ? monthlyRent
        : null
  }
  if (deposit !== undefined) {
    data.deposit =
      typeof deposit === 'number' && !Number.isNaN(deposit) ? deposit : null
  }
  if (description !== undefined) {
    const desc = (description ?? '').trim()
    if (desc.length > 2000) {
      return NextResponse.json(
        { error: '설명은 2000자 이내로 입력해주세요.' },
        { status: 400 }
      )
    }
    data.description = desc || null
  }
  if (photos !== undefined) {
    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: '사진은 최소 1장 필요합니다.' },
        { status: 400 }
      )
    }
    data.photos = JSON.stringify(photos)
  }
  if (lat !== undefined) {
    data.lat = typeof lat === 'number' && !Number.isNaN(lat) ? lat : null
  }
  if (lng !== undefined) {
    data.lng = typeof lng === 'number' && !Number.isNaN(lng) ? lng : null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, listing })
  }

  const updated = await db.vacantHouse.update({
    where: { id },
    data,
  })

  return NextResponse.json({ ok: true, listing: updated })
}
