import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const revalidate = 600 // ISR: 10분

// GET /api/v1/village/:communityId/news?limit=20&offset=0
// 공개 REST API — 일일 다이제스트 목록
export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  const { communityId } = await params
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  // Firestore doesn't have native skip/offset, so we use startAfter with a cursor approach.
  // For simplicity with offset, we fetch offset+limit and slice.
  const digestsSnap = await adminDb
    .collection('dailyDigests')
    .where('communityId', '==', communityId)
    .orderBy('date', 'desc')
    .limit(offset + limit)
    .get()

  const allDocs = digestsSnap.docs.slice(offset)

  // Total count — separate query
  const totalSnap = await adminDb
    .collection('dailyDigests')
    .where('communityId', '==', communityId)
    .count()
    .get()
  const total = totalSnap.data().count

  const items = allDocs.map((doc) => {
    const d = doc.data()
    let topKeywords: string[] = []
    let eventHighlights: string[] = []
    try { topKeywords = JSON.parse(d.topKeywords || '[]') } catch { /* ignore */ }
    try { eventHighlights = JSON.parse(d.eventHighlights || '[]') } catch { /* ignore */ }
    return {
      id: doc.id,
      date: d.date,
      summaryText: d.summaryText,
      topKeywords,
      eventHighlights,
      isMemorable: d.isMemorable,
      generatedAt: d.generatedAt?.toDate()?.toISOString() ?? null,
    }
  })

  return NextResponse.json({
    communityId: communitySnap.id,
    communityName: community.name,
    digests: items,
    total,
    limit,
    offset,
  })
}
