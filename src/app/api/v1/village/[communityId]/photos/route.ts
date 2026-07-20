import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const revalidate = 600 // ISR: 10분

// GET /api/v1/village/:communityId/photos?limit=30&offset=0
// 공개 REST API — 사진 목록 (메타데이터 포함)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  const { communityId } = await params
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  // Subcollection: communities/{communityId}/photos
  const photosSnap = await adminDb
    .collection('communities').doc(communityId).collection('photos')
    .orderBy('createdAt', 'desc')
    .limit(offset + limit)
    .get()

  const photoDocs = photosSnap.docs.slice(offset)

  // Total count
  const totalSnap = await adminDb
    .collection('communities').doc(communityId).collection('photos')
    .count()
    .get()
  const total = totalSnap.data().count

  const items = photoDocs.map((doc) => {
    const p = doc.data()
    let aiTags: string[] = []
    try { aiTags = JSON.parse(p.aiTags || '[]') } catch { /* ignore */ }
    return {
      id: doc.id,
      storageUrl: p.storageUrl,
      thumbnailUrl: p.thumbnailUrl,
      uploaderName: p.uploaderName,
      aiCaption: p.aiCaption,
      aiTags,
      exifTakenAt: p.exifTakenAt?.toDate()?.toISOString() ?? null,
      exifLat: p.exifLat ?? null,
      exifLng: p.exifLng ?? null,
      exifDevice: p.exifDevice ?? null,
      createdAt: p.createdAt?.toDate()?.toISOString() ?? null,
    }
  })

  return NextResponse.json({
    communityId: communitySnap.id,
    communityName: community.name,
    photos: items,
    total,
    limit,
    offset,
  })
}
