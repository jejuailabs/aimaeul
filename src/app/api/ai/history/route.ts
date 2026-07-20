import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

async function callClaude(systemPrompt: string, userMessage: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      console.error('[history] Claude API error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const textBlock = data.content?.find((b: any) => b.type === 'text')
    return textBlock?.text || null
  } catch (e) {
    console.error('[history] Claude API call failed:', e)
    return null
  }
}

/**
 * GET /api/ai/history?communityId=xxx&year=2026
 * Returns village history entries, optionally filtered by year.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const communityId = searchParams.get('communityId')
  const year = searchParams.get('year')

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }

  let query = adminDb
    .collection('villageHistory')
    .where('communityId', '==', communityId)
    .orderBy('date', 'desc')

  if (year) {
    query = query
      .where('date', '>=', `${year}-01-01`)
      .where('date', '<=', `${year}-12-31`)
  }

  const snap = await query.get()
  const items = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
  }))

  return NextResponse.json({ ok: true, items })
}

/**
 * POST /api/ai/history
 * Evaluates recent events and creates history entries if memorable.
 * Body: { communityId, date? }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, date: inputDate } = body as { communityId?: string; date?: string }

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
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

  const targetDate = inputDate || new Date().toISOString().slice(0, 10)
  const dayStart = new Date(`${targetDate}T00:00:00`)
  const dayEnd = new Date(`${targetDate}T23:59:59.999`)

  // Gather day's data
  const messagesSnap = await adminDb
    .collection('communities').doc(communityId).collection('messages')
    .where('createdAt', '>=', dayStart)
    .where('createdAt', '<=', dayEnd)
    .orderBy('createdAt', 'asc')
    .get()

  const photosSnap = await adminDb
    .collection('communities').doc(communityId).collection('photos')
    .where('createdAt', '>=', dayStart)
    .where('createdAt', '<=', dayEnd)
    .orderBy('createdAt', 'desc')
    .get()

  const eventsSnap = await adminDb
    .collection('events')
    .where('communityId', '==', communityId)
    .where('startAt', '>=', dayStart)
    .where('startAt', '<=', dayEnd)
    .get()

  const messages = messagesSnap.docs.map((d) => d.data())
  const photos = photosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
  const events = eventsSnap.docs.map((d) => d.data()) as any[]

  const textMessages = messages
    .filter((m: any) => m.type === 'text' && m.text)
    .map((m: any) => `${m.authorName}: ${m.text}`)
  const photoDescriptions = photos.map((p: any) => {
    const caption = p.aiCaption || ''
    let tags: string[] = []
    try { tags = typeof p.aiTags === 'string' ? JSON.parse(p.aiTags) : (p.aiTags ?? []) } catch { /* ignore */ }
    return `${p.uploaderName}님 사진${caption ? ` - ${caption}` : ''}${tags.length > 0 ? ` [${tags.join(', ')}]` : ''}`
  })
  const eventDescriptions = events.map((e: any) => `${e.title}${e.location ? ` (${e.location})` : ''}`)

  if (textMessages.length === 0 && photos.length === 0 && events.length === 0) {
    return NextResponse.json({ ok: true, created: false, reason: '활동 데이터가 없습니다.' })
  }

  const result = await evaluateAndCreateHistory({
    communityId,
    communityName: community.name,
    regionName: community.regionName,
    targetDate,
    textMessages,
    photoDescriptions,
    eventDescriptions,
    photoIds: photos.slice(0, 5).map((p: any) => p.id),
  })

  return NextResponse.json({ ok: true, ...result })
}

/**
 * Shared function: evaluates if a day's events are memorable and creates history entry.
 * Can be called from daily-digest as well.
 */
export async function evaluateAndCreateHistory(params: {
  communityId: string
  communityName: string
  regionName: string
  targetDate: string
  textMessages: string[]
  photoDescriptions: string[]
  eventDescriptions: string[]
  photoIds: string[]
}): Promise<{ created: boolean; historyId?: string; reason?: string }> {
  const {
    communityId,
    communityName,
    regionName,
    targetDate,
    textMessages,
    photoDescriptions,
    eventDescriptions,
    photoIds,
  } = params

  const systemPrompt = `당신은 한국 농촌 마을 공동체의 역사를 기록하는 AI 아키비스트입니다.
오늘의 마을 활동을 보고, 마을 역사에 기록할 만한 기념적인 사건인지 판단해주세요.

기념할 만한 사건의 예시:
- 첫눈, 태풍, 벚꽃 개화 등 계절/자연 이벤트
- 축제, 운동회, 마을잔치 등 마을 행사
- 큰 수확, 공동 작업 등 중요한 농사 활동
- 마을에 새로운 시설이 생기거나 큰 변화가 있을 때
- 특별한 방문이나 기념일

결과는 반드시 아래 JSON 형식으로만 응답해주세요:
{
  "isMemorable": true 또는 false,
  "reason": "판단 이유 (한 문장)",
  "title": "기록 제목 (기념할 만한 경우에만)",
  "description": "기록 설명 2-3문장 (기념할 만한 경우에만)",
  "category": "행사" 또는 "사건" 또는 "기록" (기념할 만한 경우에만)
}`

  const userMessage = `마을: ${communityName} (${regionName})
날짜: ${targetDate}

오늘의 대화 (${textMessages.length}건):
${textMessages.slice(0, 30).join('\n') || '(대화 없음)'}

오늘의 사진 (${photoDescriptions.length}장):
${photoDescriptions.join('\n') || '(사진 없음)'}

오늘의 행사:
${eventDescriptions.join('\n') || '(행사 없음)'}

오늘의 활동 중 마을 역사에 기록할 만한 기념적인 사건이 있나요?`

  const aiResponse = await callClaude(systemPrompt, userMessage)
  if (!aiResponse) {
    return { created: false, reason: 'AI 판단 실패' }
  }

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || aiResponse)

    if (!parsed.isMemorable) {
      return { created: false, reason: parsed.reason || '기념할 만한 사건이 아닙니다.' }
    }

    // Check for duplicate (idempotent)
    const existingSnap = await adminDb
      .collection('villageHistory')
      .where('communityId', '==', communityId)
      .where('date', '==', targetDate)
      .get()

    if (!existingSnap.empty) {
      return { created: false, historyId: existingSnap.docs[0].id, reason: '이미 기록된 날짜입니다.' }
    }

    const historyData = {
      communityId,
      title: parsed.title || `${targetDate} 마을 기록`,
      description: parsed.description || '',
      date: targetDate,
      category: parsed.category || '기록',
      relatedPhotoIds: photoIds,
      createdAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection('villageHistory').add(historyData)
    return { created: true, historyId: docRef.id }
  } catch (e) {
    console.error('[history] Failed to parse AI response:', e)
    return { created: false, reason: 'AI 응답 파싱 실패' }
  }
}
