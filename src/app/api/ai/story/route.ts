import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, photoIds } = body as { communityId?: string; photoIds?: string[] }

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: '사진을 1장 이상 선택해주세요.' }, { status: 400 })
  }
  if (photoIds.length > 20) {
    return NextResponse.json({ error: '사진은 최대 20장까지 선택 가능합니다.' }, { status: 400 })
  }

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = commDoc.data()!

  const photos: any[] = []
  for (const pid of photoIds) {
    const doc = await adminDb
      .collection('communities').doc(communityId).collection('photos').doc(pid).get()
    if (doc.exists) photos.push({ id: doc.id, ...doc.data() })
  }

  if (photos.length === 0) {
    return NextResponse.json({ error: '해당 사진을 찾을 수 없습니다.' }, { status: 404 })
  }

  const photoDescriptions = photos.map((p, i) => {
    const caption = p.aiCaption || '(설명 없음)'
    let tags: string[] = []
    try { tags = typeof p.aiTags === 'string' ? JSON.parse(p.aiTags) : (p.aiTags ?? []) } catch { /* ignore */ }
    const takenAt = p.exifTakenAt?.toDate?.()
      ? p.exifTakenAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : p.createdAt?.toDate?.()
        ? p.createdAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        : '알 수 없는 날짜'
    const device = p.exifDevice || ''
    const location = p.exifLat && p.exifLng ? `위치: ${p.exifLat.toFixed(4)}, ${p.exifLng.toFixed(4)}` : ''
    return `사진 ${i + 1}:\n- 촬영자: ${p.uploaderName}\n- 날짜: ${takenAt}\n- 설명: ${caption}\n- 태그: ${tags.join(', ') || '없음'}${device ? `\n- 카메라: ${device}` : ''}${location ? `\n- ${location}` : ''}`
  })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: true, story: generateFallbackStory(community.name, photos) })
  }

  const systemPrompt = `당신은 한국 농촌 마을의 이야기를 아름답게 풀어내는 이야기꾼입니다.
주어진 사진들의 정보를 바탕으로 마을의 하루, 계절, 또는 특별한 순간을 담은 따뜻한 이야기를 만들어주세요.
- 사진 속 인물의 이름을 자연스럽게 포함하세요.
- 계절감, 날씨, 풍경 묘사를 곁들여주세요.
- 마을 공동체의 따뜻한 분위기를 담아주세요.
- 300-500자 분량으로 작성해주세요.
- 마크다운 형식 없이 순수 텍스트로 작성해주세요.`

  const userMessage = `마을 이름: ${community.name} (${community.regionName})\n\n사진 정보:\n${photoDescriptions.join('\n\n')}\n\n이 사진들을 엮어 하나의 따뜻한 마을 이야기를 만들어주세요.`

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ ok: true, story: generateFallbackStory(community.name, photos) })
    }
    const data = await res.json()
    const story = data.content?.find((b: any) => b.type === 'text')?.text || generateFallbackStory(community.name, photos)
    return NextResponse.json({ ok: true, story })
  } catch {
    return NextResponse.json({ ok: true, story: generateFallbackStory(community.name, photos) })
  }
}

function generateFallbackStory(communityName: string, photos: any[]): string {
  const uploaders = [...new Set(photos.map((p: any) => p.uploaderName))]
  const firstDate = photos[0]?.exifTakenAt?.toDate?.() || photos[0]?.createdAt?.toDate?.()
  const dateStr = firstDate
    ? firstDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '어느 날'
  const captions = photos.map((p: any) => p.aiCaption).filter(Boolean).slice(0, 3)
  return [
    `${dateStr}, ${communityName}에서는 특별한 하루가 펼쳐졌습니다.`,
    uploaders.length > 1
      ? `${uploaders.join(', ')}님이 함께 마을의 순간들을 카메라에 담았습니다.`
      : `${uploaders[0]}님이 마을의 순간을 카메라에 담았습니다.`,
    captions.length > 0
      ? `${captions.join(', ')} — 이 모든 것이 우리 마을의 소중한 기억이 됩니다.`
      : '이 모든 순간이 우리 마을의 소중한 기억이 됩니다.',
    `${communityName}의 이야기는 계속됩니다.`,
  ].join(' ')
}
