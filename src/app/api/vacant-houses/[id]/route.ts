import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['게시중', '거래완료', '게시중지'])

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const doc = await adminDb.collection('vacantHouses').doc(id).get()

  if (!doc.exists) {
    return NextResponse.json({ error: '매물을 찾을 수 없습니다.' }, { status: 404 })
  }

  const listing = doc.data()!
  const commDoc = await adminDb.collection('communities').doc(listing.communityId).get()
  const comm = commDoc.data()

  if (comm && !comm.isPublic) {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 401 })
    }
    const isMember = user.communities.some((c) => c.id === listing.communityId)
    if (!isMember) {
      return NextResponse.json({ error: '열람 권한이 없습니다.' }, { status: 403 })
    }
  }

  return NextResponse.json({
    listing: {
      id: doc.id,
      ...listing,
      createdAt: listing.createdAt?.toDate?.()?.toISOString?.() ?? null,
      community: comm
        ? {
            id: commDoc.id,
            name: comm.name,
            regionName: comm.regionName,
            communityType: comm.communityType,
            isPublic: comm.isPublic,
          }
        : null,
    },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params

  const doc = await adminDb.collection('vacantHouses').doc(id).get()
  if (!doc.exists) {
    return NextResponse.json({ error: '매물을 찾을 수 없습니다.' }, { status: 404 })
  }
  const listing = doc.data()!
  if (listing.posterId !== user.uid) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { status, monthlyRent, deposit, description, photos, lat, lng } = body as {
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
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
    }
    data.status = status
  }
  if (monthlyRent !== undefined) {
    data.monthlyRent = typeof monthlyRent === 'number' && !Number.isNaN(monthlyRent) ? monthlyRent : null
  }
  if (deposit !== undefined) {
    data.deposit = typeof deposit === 'number' && !Number.isNaN(deposit) ? deposit : null
  }
  if (description !== undefined) {
    const desc = (description ?? '').trim()
    if (desc.length > 2000) {
      return NextResponse.json({ error: '설명은 2000자 이내로 입력해주세요.' }, { status: 400 })
    }
    data.description = desc || null
  }
  if (photos !== undefined) {
    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: '사진은 최소 1장 필요합니다.' }, { status: 400 })
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
    return NextResponse.json({ ok: true, listing: { id, ...listing } })
  }

  await adminDb.collection('vacantHouses').doc(id).update(data)
  const updated = await adminDb.collection('vacantHouses').doc(id).get()

  return NextResponse.json({ ok: true, listing: { id, ...updated.data() } })
}
