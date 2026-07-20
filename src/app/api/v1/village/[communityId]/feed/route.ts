import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const revalidate = 600 // ISR: 10분

// GET /api/v1/village/:communityId/feed?date=yyyy-mm-dd
// 공개 REST API — 최근 사진, 메시지를 시간순으로 반환
export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  const { communityId } = await params
  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  // 날짜 범위
  let dayStart: Date
  let dayEnd: Date
  if (dateParam) {
    dayStart = new Date(`${dateParam}T00:00:00`)
    dayEnd = new Date(`${dateParam}T23:59:59.999`)
  } else {
    // 기본: 최근 24시간
    dayEnd = new Date()
    dayStart = new Date(dayEnd.getTime() - 24 * 60 * 60 * 1000)
  }

  // 메시지 (photo, game_result, text 타입) — subcollection
  const messagesSnap = await adminDb
    .collection('communities').doc(communityId).collection('messages')
    .where('type', 'in', ['photo', 'game_result', 'text'])
    .where('createdAt', '>=', dayStart)
    .where('createdAt', '<=', dayEnd)
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get()

  const messages = messagesSnap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      type: d.type as string,
      photoId: d.photoId as string | null,
      text: d.text as string | null,
      authorName: d.authorName as string,
      gameResultPayload: d.gameResultPayload as string | null,
      createdAt: d.createdAt?.toDate() as Date,
    }
  })

  // 관련 사진 ID 수집 — subcollection
  const photoIds = messages.map((m) => m.photoId).filter((x): x is string => !!x)
  const photoMap = new Map<string, any>()
  if (photoIds.length) {
    // Firestore 'in' queries support max 30 items; batch if needed
    const batches: string[][] = []
    for (let i = 0; i < photoIds.length; i += 30) {
      batches.push(photoIds.slice(i, i + 30))
    }
    for (const batch of batches) {
      const photosSnap = await adminDb
        .collection('communities').doc(communityId).collection('photos')
        .where('__name__', 'in', batch)
        .get()
      for (const doc of photosSnap.docs) {
        const p = doc.data()
        photoMap.set(doc.id, {
          id: doc.id,
          storageUrl: p.storageUrl,
          thumbnailUrl: p.thumbnailUrl,
          aiCaption: p.aiCaption,
          uploaderName: p.uploaderName,
          exifTakenAt: p.exifTakenAt?.toDate() ?? null,
        })
      }
    }
  }

  // 이벤트 — top-level collection
  const eventsSnap = await adminDb
    .collection('events')
    .where('communityId', '==', communityId)
    .where('startAt', '>=', dayStart)
    .where('startAt', '<=', dayEnd)
    .orderBy('startAt', 'asc')
    .get()

  const events = eventsSnap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      title: d.title as string,
      location: d.location as string | null,
      startAt: (d.startAt?.toDate() as Date),
    }
  })

  // 타임라인 아이템 구성
  type TimelineItem = {
    id: string
    type: 'photo' | 'game_result' | 'event' | 'text'
    time: string
    authorName: string
    text?: string
    photoUrl?: string
    caption?: string
    gamePayload?: any
    eventTitle?: string
    eventLocation?: string
  }

  const items: TimelineItem[] = []

  for (const m of messages) {
    if (m.type === 'photo' && m.photoId) {
      const photo = photoMap.get(m.photoId)
      if (photo) {
        items.push({
          id: m.id,
          type: 'photo',
          time: m.createdAt.toISOString(),
          authorName: m.authorName,
          photoUrl: photo.thumbnailUrl || photo.storageUrl,
          caption: photo.aiCaption || undefined,
        })
      }
    } else if (m.type === 'game_result') {
      let payload = null
      try {
        payload = m.gameResultPayload && m.gameResultPayload !== 'null'
          ? JSON.parse(m.gameResultPayload)
          : null
      } catch { /* ignore */ }
      items.push({
        id: m.id,
        type: 'game_result',
        time: m.createdAt.toISOString(),
        authorName: m.authorName,
        gamePayload: payload,
      })
    } else if (m.type === 'text' && m.text) {
      items.push({
        id: m.id,
        type: 'text',
        time: m.createdAt.toISOString(),
        authorName: m.authorName,
        text: m.text,
      })
    }
  }

  for (const ev of events) {
    items.push({
      id: ev.id,
      type: 'event',
      time: ev.startAt.toISOString(),
      authorName: '',
      eventTitle: ev.title,
      eventLocation: ev.location || undefined,
    })
  }

  // 시간순 정렬
  items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return NextResponse.json({
    communityId: communitySnap.id,
    communityName: community.name,
    date: dateParam || new Date().toISOString().slice(0, 10),
    items,
    total: items.length,
  })
}
