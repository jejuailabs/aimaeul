import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const communityId = url.searchParams.get('communityId')
  const cursor = url.searchParams.get('cursor')
  const limitParam = parseInt(url.searchParams.get('limit') || '30', 10)
  const limit = Math.min(Math.max(limitParam, 1), 50)

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  let query = adminDb
    .collection('communities')
    .doc(communityId)
    .collection('photos')
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query

  if (cursor) {
    const cursorDoc = await adminDb
      .collection('communities')
      .doc(communityId)
      .collection('photos')
      .doc(cursor)
      .get()
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc)
    }
  }

  const snap = await query.limit(limit).get()

  const photos = snap.docs.map((doc) => {
    const p = doc.data()
    let aiTags: string[] = []
    try {
      aiTags = typeof p.aiTags === 'string' ? JSON.parse(p.aiTags) : (p.aiTags ?? [])
    } catch { /* ignore */ }
    return {
      id: doc.id,
      storageUrl: p.storageUrl ?? '',
      thumbnailUrl: p.thumbnailUrl ?? '',
      uploaderName: p.uploaderName ?? '',
      exifTakenAt: p.exifTakenAt?.toDate?.()?.toISOString?.() ?? null,
      exifLat: p.exifLat ?? null,
      exifLng: p.exifLng ?? null,
      exifDevice: p.exifDevice ?? null,
      exifLens: p.exifLens ?? null,
      exifAddress: p.exifAddress ?? null,
      aiTags,
      aiCaption: p.aiCaption ?? null,
      createdAt: p.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    }
  })

  const hasMore = snap.docs.length === limit
  const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null

  return NextResponse.json({ photos, nextCursor, hasMore })
}
