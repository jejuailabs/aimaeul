import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['게시중', '거래완료', '게시중지'])

// POST /api/vacant-houses  { communityId, photos: string[], monthlyRent?, deposit?, description?, lat?, lng? }
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    communityId,
    photos,
    monthlyRent,
    deposit,
    description,
    lat,
    lng,
  } = body as {
    communityId?: string
    photos?: string[]
    monthlyRent?: number | null
    deposit?: number | null
    description?: string | null
    lat?: number | null
    lng?: number | null
  }

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ error: '사진을 최소 1장 업로드해주세요.' }, { status: 400 })
  }
  if (photos.length > 20) {
    return NextResponse.json({ error: '사진은 최대 20장까지 가능합니다.' }, { status: 400 })
  }

  // 멤버십 검증
  const member = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
  })
  if (!member) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  // 가격 검증 (둘 다 null 이면 "가격 협의")
  const rent = typeof monthlyRent === 'number' && !Number.isNaN(monthlyRent) ? monthlyRent : null
  const dep = typeof deposit === 'number' && !Number.isNaN(deposit) ? deposit : null
  if (rent !== null && (rent < 0 || rent > 100000)) {
    return NextResponse.json({ error: '월세는 0~100000만원 사이로 입력해주세요.' }, { status: 400 })
  }
  if (dep !== null && (dep < 0 || dep > 100000)) {
    return NextResponse.json({ error: '보증금은 0~100000만원 사이로 입력해주세요.' }, { status: 400 })
  }

  const desc = (description ?? '').trim()
  if (desc.length > 2000) {
    return NextResponse.json({ error: '설명은 2000자 이내로 입력해주세요.' }, { status: 400 })
  }

  const listing = await db.vacantHouse.create({
    data: {
      communityId,
      posterId: user.id,
      photos: JSON.stringify(photos),
      monthlyRent: rent,
      deposit: dep,
      description: desc || null,
      lat: typeof lat === 'number' && !Number.isNaN(lat) ? lat : null,
      lng: typeof lng === 'number' && !Number.isNaN(lng) ? lng : null,
      status: '게시중',
    },
  })

  return NextResponse.json({ ok: true, listing })
}

// GET /api/vacant-houses?communityId=xxx — 내가 속한 마을의 빈집 목록
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const filterCommunityId = url.searchParams.get('communityId')

  const communityIds = user.communities.map((c) => c.id)
  if (communityIds.length === 0) {
    return NextResponse.json({ listings: [] })
  }

  const where = filterCommunityId
    ? { communityId: filterCommunityId }
    : { communityId: { in: communityIds } }

  const listings = await db.vacantHouse.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      community: {
        select: { id: true, name: true, regionName: true, communityType: true },
      },
    },
    take: 200,
  })

  return NextResponse.json({ listings })
}
