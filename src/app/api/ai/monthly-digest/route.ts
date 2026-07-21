import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

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
    if (!res.ok) return null
    const data = await res.json()
    return data.content?.find((b: any) => b.type === 'text')?.text || null
  } catch { return null }
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, month: inputMonth } = body as { communityId?: string; month?: string }

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

  const now = new Date()
  const targetMonth = inputMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [yearStr, monthStr] = targetMonth.split('-')
  const year = parseInt(yearStr, 10)
  const monthNum = parseInt(monthStr, 10)
  const monthStart = new Date(year, monthNum - 1, 1)
  const monthEnd = new Date(year, monthNum, 1)

  const digestId = `${communityId}_${targetMonth}`
  const existingDoc = await adminDb.collection('monthlyDigests').doc(digestId).get()
  if (existingDoc.exists) {
    return NextResponse.json({ ok: true, digest: { id: digestId, ...existingDoc.data() }, cached: true })
  }

  const [photosSnap, messagesSnap, eventsSnap] = await Promise.all([
    adminDb.collection('communities').doc(communityId).collection('photos')
      .where('createdAt', '>=', monthStart).where('createdAt', '<', monthEnd).get(),
    adminDb.collection('communities').doc(communityId).collection('messages')
      .where('createdAt', '>=', monthStart).where('createdAt', '<', monthEnd).get(),
    adminDb.collection('events')
      .where('communityId', '==', communityId)
      .where('startAt', '>=', monthStart).where('startAt', '<', monthEnd).get(),
  ])

  const photoCount = photosSnap.size
  const messageCount = messagesSnap.size
  const eventCount = eventsSnap.size

  const dailyDigestsSnap = await adminDb
    .collection('dailyDigests')
    .where('communityId', '==', communityId)
    .where('date', '>=', targetMonth + '-01')
    .where('date', '<=', targetMonth + '-31')
    .orderBy('date', 'asc')
    .get()

  const keywordCounts = new Map<string, number>()
  for (const d of dailyDigestsSnap.docs) {
    const data = d.data()
    let keywords: string[] = []
    try { keywords = JSON.parse(data.topKeywords || '[]') } catch { /* ignore */ }
    for (const kw of keywords) {
      keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1)
    }
  }
  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([kw]) => kw)

  const memberCounts = new Map<string, number>()
  for (const d of messagesSnap.docs) {
    const m = d.data()
    memberCounts.set(m.authorName, (memberCounts.get(m.authorName) || 0) + 1)
  }
  const topMembers = [...memberCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name)

  const placeCounts = new Map<string, number>()
  for (const d of eventsSnap.docs) {
    const e = d.data()
    if (e.location) placeCounts.set(e.location, (placeCounts.get(e.location) || 0) + 1)
  }
  const topPlaces = [...placeCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([place]) => place)

  const dailySummaries = dailyDigestsSnap.docs
    .map((d) => { const data = d.data(); return `${data.date}: ${data.summaryText}` })
    .join('\n')

  const systemPrompt = `당신은 한국 농촌 마을 공동체의 월간 소식을 정리하는 AI 기자입니다.
따뜻하고 친근한 어조로 한 달간의 마을 이야기를 요약해주세요.
결과는 3-5문장의 자연스러운 한국어 문장으로 응답해주세요.`

  const userMessage = `마을 이름: ${community.name} (${community.regionName})
기간: ${targetMonth}
월간 통계: 메시지 ${messageCount}건, 사진 ${photoCount}장, 행사 ${eventCount}건
주요 키워드: ${topKeywords.join(', ') || '없음'}
활발한 주민: ${topMembers.join(', ') || '없음'}
주요 장소: ${topPlaces.join(', ') || '없음'}
일별 소식 요약:
${dailySummaries || '(일일 소식 없음)'}`

  const aiResponse = await callClaude(systemPrompt, userMessage)
  const summaryText = aiResponse || [
    `${targetMonth} ${community.name} 월간 소식`,
    '',
    `이번 달 총 ${messageCount}건의 대화, ${photoCount}장의 사진, ${eventCount}건의 행사가 있었습니다.`,
    topMembers.length > 0 ? `가장 활발한 주민: ${topMembers.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const digestData = {
    communityId,
    month: targetMonth,
    photoCount,
    eventCount,
    messageCount,
    newMemberCount: 0,
    topPlaces: JSON.stringify(topPlaces),
    topKeywords: JSON.stringify(topKeywords),
    topMembers: JSON.stringify(topMembers),
    summaryText,
    createdAt: FieldValue.serverTimestamp(),
  }

  await adminDb.collection('monthlyDigests').doc(digestId).set(digestData)

  return NextResponse.json({ ok: true, digest: { id: digestId, ...digestData } })
}
