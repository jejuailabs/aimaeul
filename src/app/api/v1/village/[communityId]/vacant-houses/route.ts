import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { formatRent } from '@/lib/village'

export const revalidate = 600 // ISR: 10분

// GET /api/v1/village/:communityId/vacant-houses?limit=30
// 공개 REST API — 게시 중인 빈집 매물 목록
export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  const { communityId } = await params
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100)

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  const listingsSnap = await adminDb
    .collection('vacantHouses')
    .where('communityId', '==', communityId)
    .where('status', '==', '게시중')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  // Resolve poster names via separate reads from users collection
  const items = await Promise.all(
    listingsSnap.docs.map(async (doc) => {
      const l = doc.data()
      let photos: string[] = []
      try { photos = JSON.parse(l.photos || '[]') } catch { /* ignore */ }

      let posterName = ''
      if (l.posterId) {
        const posterSnap = await adminDb.collection('users').doc(l.posterId).get()
        if (posterSnap.exists) {
          posterName = posterSnap.data()?.name || ''
        }
      }

      return {
        id: doc.id,
        photos,
        monthlyRent: l.monthlyRent,
        deposit: l.deposit,
        rentDisplay: formatRent(l.monthlyRent, l.deposit),
        description: l.description,
        lat: l.lat,
        lng: l.lng,
        status: l.status,
        posterName,
        createdAt: l.createdAt?.toDate()?.toISOString() ?? null,
      }
    }),
  )

  return NextResponse.json({
    communityId: communitySnap.id,
    communityName: community.name,
    regionName: community.regionName,
    vacantHouses: items,
    total: items.length,
  })
}
