import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, photos, monthlyRent, deposit, description, lat, lng } = body as {
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

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

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

  const listingRef = adminDb.collection('vacantHouses').doc()
  const listingData = {
    communityId,
    posterId: user.uid,
    photos: JSON.stringify(photos),
    monthlyRent: rent,
    deposit: dep,
    description: desc || null,
    lat: typeof lat === 'number' && !Number.isNaN(lat) ? lat : null,
    lng: typeof lng === 'number' && !Number.isNaN(lng) ? lng : null,
    status: '게시중',
    createdAt: FieldValue.serverTimestamp(),
  }
  await listingRef.set(listingData)

  return NextResponse.json({ ok: true, listing: { id: listingRef.id, ...listingData } })
}

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

  let q: FirebaseFirestore.Query = adminDb.collection('vacantHouses')
  if (filterCommunityId) {
    q = q.where('communityId', '==', filterCommunityId)
  } else {
    q = q.where('communityId', 'in', communityIds.slice(0, 10))
  }
  q = q.orderBy('createdAt', 'desc').limit(200)

  const snap = await q.get()
  const listings = await Promise.all(
    snap.docs.map(async (doc) => {
      const d = doc.data()
      const commDoc = await adminDb.collection('communities').doc(d.communityId).get()
      const comm = commDoc.data()
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
        community: comm
          ? { id: commDoc.id, name: comm.name, regionName: comm.regionName, communityType: comm.communityType }
          : null,
      }
    })
  )

  return NextResponse.json({ listings })
}
