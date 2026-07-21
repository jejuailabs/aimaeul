import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { evaluateAndCreateHistory } from '@/app/api/ai/history/route'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

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
      console.error('[daily-digest] Claude API error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const textBlock = data.content?.find((b: any) => b.type === 'text')
    return textBlock?.text || null
  } catch (e) {
    console.error('[daily-digest] Claude API call failed:', e)
    return null
  }
}

function generateTemplateSummary(
  communityName: string,
  date: string,
  messageCount: number,
  photoCount: number,
  events: { title: string }[],
  topUploaders: string[],
) {
  const eventList = events.map((e) => e.title).join(', ') || '없음'
  const uploaderList = topUploaders.join(', ') || '없음'
  const summaryText = [
    `${date} ${communityName} 일일 소식`,
    '',
    `오늘 하루 총 ${messageCount}건의 대화와 ${photoCount}장의 사진이 공유되었습니다.`,
    events.length > 0 ? `예정된 행사: ${eventList}` : '오늘 예정된 행사는 없습니다.',
    topUploaders.length > 0 ? `활발하게 활동한 주민: ${uploaderList}` : '',
  ].filter(Boolean).join('\n')
  const topKeywords = [
    ...(photoCount > 0 ? ['사진'] : []),
    ...(events.length > 0 ? ['행사'] : []),
    ...(messageCount > 10 ? ['활발한 대화'] : []),
  ]
  return { summaryText, topKeywords }
}

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

  const digestId = `${communityId}_${targetDate}`
  const existingDoc = await adminDb.collection('dailyDigests').doc(digestId).get()
  if (existingDoc.exists) {
    return NextResponse.json({ ok: true, digest: { id: digestId, ...existingDoc.data() }, cached: true })
  }

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

  const tomorrowStart = new Date(dayEnd.getTime() + 1)
  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setHours(23, 59, 59, 999)
  const tomorrowSnap = await adminDb
    .collection('events')
    .where('communityId', '==', communityId)
    .where('startAt', '>=', tomorrowStart)
    .where('startAt', '<=', tomorrowEnd)
    .get()
  const tomorrowEvents = tomorrowSnap.docs.map((d) => d.data()) as any[]

  const activityCounts = new Map<string, number>()
  for (const p of photos) {
    activityCounts.set(p.uploaderName, (activityCounts.get(p.uploaderName) || 0) + 1)
  }
  for (const m of messages) {
    activityCounts.set(m.authorName, (activityCounts.get(m.authorName) || 0) + 1)
  }
  const topUploaders = [...activityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  const topPhotoIds = photos.slice(0, 5).map((p: any) => p.id)

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

  const systemPrompt = `당신은 한국 농촌 마을 공동체의 일일 소식을 정리하는 AI 기자입니다.
따뜻하고 친근한 어조로 마을 소식을 요약해주세요.
결과는 반드시 아래 JSON 형식으로만 응답해주세요:
{
  "summaryText": "마을 소식 요약 (3-5문장)",
  "topKeywords": ["키워드1", "키워드2", "키워드3"],
  "eventHighlights": ["행사 하이라이트1", "행사 하이라이트2"]
}`

  const userMessage = `마을 이름: ${community.name} (${community.regionName})
날짜: ${targetDate}

오늘의 대화 (${textMessages.length}건):
${textMessages.slice(0, 50).join('\n') || '(대화 없음)'}

오늘의 사진 (${photos.length}장):
${photoDescriptions.join('\n') || '(사진 없음)'}

오늘의 행사:
${eventDescriptions.join('\n') || '(행사 없음)'}

활발한 주민: ${topUploaders.join(', ') || '없음'}

내일 예정 행사:
${tomorrowEvents.map((e: any) => e.title).join(', ') || '없음'}`

  let summaryText: string
  let topKeywords: string[]
  let eventHighlights: string[]

  const aiResponse = await callClaude(systemPrompt, userMessage)
  if (aiResponse) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch?.[0] || aiResponse)
      summaryText = parsed.summaryText || aiResponse
      topKeywords = Array.isArray(parsed.topKeywords) ? parsed.topKeywords : []
      eventHighlights = Array.isArray(parsed.eventHighlights) ? parsed.eventHighlights : []
    } catch {
      summaryText = aiResponse
      topKeywords = []
      eventHighlights = eventDescriptions
    }
  } else {
    const template = generateTemplateSummary(community.name, targetDate, messages.length, photos.length, events, topUploaders)
    summaryText = template.summaryText
    topKeywords = template.topKeywords
    eventHighlights = eventDescriptions
  }

  const tomorrowPreview = tomorrowEvents.length > 0 ? tomorrowEvents.map((e: any) => e.title).join(', ') : null

  const digestData = {
    communityId,
    date: targetDate,
    summaryText,
    topPhotos: JSON.stringify(topPhotoIds),
    eventHighlights: JSON.stringify(eventHighlights),
    topKeywords: JSON.stringify(topKeywords),
    tomorrowSchedulePreview: tomorrowPreview,
    isMemorable: messages.length > 50 || photos.length > 10,
    createdAt: FieldValue.serverTimestamp(),
  }

  await adminDb.collection('dailyDigests').doc(digestId).set(digestData)

  // --- History evaluation: check if today's events are memorable ---
  let historyResult: { created: boolean; historyId?: string; reason?: string } | null = null
  try {
    historyResult = await evaluateAndCreateHistory({
      communityId,
      communityName: community.name,
      regionName: community.regionName,
      targetDate,
      textMessages,
      photoDescriptions,
      eventDescriptions,
      photoIds: topPhotoIds,
    })
  } catch (e) {
    console.error('[daily-digest] History evaluation failed (non-blocking):', e)
  }

  return NextResponse.json({
    ok: true,
    digest: { id: digestId, ...digestData },
    history: historyResult,
  })
}
