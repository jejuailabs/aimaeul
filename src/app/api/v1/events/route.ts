import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const revalidate = 600 // ISR: 10분

// GET /api/v1/events?communityId=xxx&limit=20&upcoming=true
// 공개 REST API — 행사 목록
export async function GET(req: Request) {
  const url = new URL(req.url)
  const communityId = url.searchParams.get('communityId')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
  const upcoming = url.searchParams.get('upcoming') !== 'false'

  if (!communityId) {
    return NextResponse.json({ error: 'communityId 파라미터가 필요합니다.' }, { status: 400 })
  }

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  let query = adminDb
    .collection('events')
    .where('communityId', '==', communityId) as FirebaseFirestore.Query

  if (upcoming) {
    query = query
      .where('startAt', '>=', new Date())
      .orderBy('startAt', 'asc')
  } else {
    query = query.orderBy('startAt', 'desc')
  }

  query = query.limit(limit)

  const eventsSnap = await query.get()

  const items = eventsSnap.docs.map((doc) => {
    const e = doc.data()
    return {
      id: doc.id,
      title: e.title,
      description: e.description,
      startAt: e.startAt?.toDate()?.toISOString() ?? null,
      endAt: e.endAt?.toDate()?.toISOString() ?? null,
      location: e.location,
      createdAt: e.createdAt?.toDate()?.toISOString() ?? null,
    }
  })

  return NextResponse.json({
    communityId: communitySnap.id,
    communityName: community.name,
    events: items,
    total: items.length,
  })
}
