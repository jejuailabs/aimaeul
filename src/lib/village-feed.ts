import { adminDb } from '@/lib/firebase-admin'

export type FeedItem = {
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

/**
 * Fetch village feed data for a community.
 * Shared between feed, feed.json, and feed.md endpoints.
 */
export async function fetchVillageFeed(
  communityId: string,
  community: FirebaseFirestore.DocumentData,
  dateParam: string | null,
) {
  let dayStart: Date
  let dayEnd: Date
  if (dateParam) {
    dayStart = new Date(`${dateParam}T00:00:00`)
    dayEnd = new Date(`${dateParam}T23:59:59.999`)
  } else {
    dayEnd = new Date()
    dayStart = new Date(dayEnd.getTime() - 24 * 60 * 60 * 1000)
  }

  // Messages (photo, game_result, text types)
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

  // Fetch related photos
  const photoIds = messages.map((m) => m.photoId).filter((x): x is string => !!x)
  const photoMap = new Map<string, any>()
  if (photoIds.length) {
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

  // Events
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
      startAt: d.startAt?.toDate() as Date,
    }
  })

  // Build timeline items
  const items: FeedItem[] = []

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

  // Sort by time
  items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return {
    communityId,
    communityName: community.name as string,
    date: dateParam || new Date().toISOString().slice(0, 10),
    items,
    total: items.length,
  }
}
