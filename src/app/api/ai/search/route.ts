import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

function parseKoreanDateKeyword(query: string): { start: Date; end: Date } | null {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (query.includes('오늘')) {
    const start = new Date(year, month, now.getDate())
    const end = new Date(year, month, now.getDate() + 1)
    return { start, end }
  }
  if (query.includes('어제')) {
    const start = new Date(year, month, now.getDate() - 1)
    const end = new Date(year, month, now.getDate())
    return { start, end }
  }
  if (query.includes('이번주') || query.includes('이번 주')) {
    const day = now.getDay()
    const start = new Date(year, month, now.getDate() - day)
    const end = new Date(year, month, now.getDate() + (7 - day))
    return { start, end }
  }
  if (query.includes('지난주') || query.includes('지난 주')) {
    const day = now.getDay()
    const start = new Date(year, month, now.getDate() - day - 7)
    const end = new Date(year, month, now.getDate() - day)
    return { start, end }
  }
  if (query.includes('이번달') || query.includes('이번 달')) {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 1)
    return { start, end }
  }
  if (query.includes('지난달') || query.includes('지난 달')) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    return { start, end }
  }
  if (query.includes('작년') || query.includes('지난해')) {
    const start = new Date(year - 1, 0, 1)
    const end = new Date(year, 0, 1)
    return { start, end }
  }
  if (query.includes('올해') || query.includes('올 해')) {
    const start = new Date(year, 0, 1)
    const end = new Date(year + 1, 0, 1)
    return { start, end }
  }

  const monthMatch = query.match(/(\d{1,2})월/)
  if (monthMatch) {
    const m = parseInt(monthMatch[1], 10) - 1
    const start = new Date(year, m, 1)
    const end = new Date(year, m + 1, 1)
    return { start, end }
  }

  return null
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, query } = body as {
    communityId?: string
    query?: string
  }

  if (!communityId || !query?.trim()) {
    return NextResponse.json({ error: 'communityId와 query가 필요합니다.' }, { status: 400 })
  }

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const q = query.trim()
  const keywords = q.split(/\s+/).filter(Boolean)
  const dateRange = parseKoreanDateKeyword(q)

  let photosQuery: FirebaseFirestore.Query = adminDb
    .collection('communities')
    .doc(communityId)
    .collection('photos')
    .orderBy('createdAt', 'desc')
    .limit(500)

  const photosSnap = await photosQuery.get()

  const scored = photosSnap.docs.map((doc) => {
    const photo = doc.data()
    let score = 0
    const tagsStr = photo.aiTags || '[]'
    const caption = (photo.aiCaption || '').toLowerCase()
    const uploaderName = (photo.uploaderName || '').toLowerCase()
    const device = (photo.exifDevice || '').toLowerCase()

    let tags: string[] = []
    try {
      tags = typeof tagsStr === 'string' ? JSON.parse(tagsStr) : tagsStr
    } catch { /* ignore */ }

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase()
      if (tags.some((t: string) => t.toLowerCase().includes(kwLower))) score += 3
      if (caption.includes(kwLower)) score += 2
      if (uploaderName.includes(kwLower)) score += 1
      if (device.includes(kwLower)) score += 1
    }

    if (dateRange) {
      const takenAt = photo.exifTakenAt?.toDate?.() ?? null
      const createdAt = photo.createdAt?.toDate?.() ?? null
      const inRange = (d: Date | null) =>
        d && d >= dateRange.start && d < dateRange.end
      if (inRange(takenAt) || inRange(createdAt)) {
        score += 1
      }
    }

    return { doc, photo, score }
  })

  const results = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((s) => {
      let tags: string[] = []
      try {
        tags = typeof s.photo.aiTags === 'string' ? JSON.parse(s.photo.aiTags) : (s.photo.aiTags ?? [])
      } catch { /* ignore */ }
      return {
        id: s.doc.id,
        storageUrl: s.photo.storageUrl,
        thumbnailUrl: s.photo.thumbnailUrl,
        aiCaption: s.photo.aiCaption,
        aiTags: tags,
        uploaderName: s.photo.uploaderName,
        exifTakenAt: s.photo.exifTakenAt?.toDate?.()?.toISOString?.() ?? null,
        exifDevice: s.photo.exifDevice,
        createdAt: s.photo.createdAt?.toDate?.()?.toISOString?.() ?? null,
        score: s.score,
      }
    })

  return NextResponse.json({ photos: results, total: results.length })
}
