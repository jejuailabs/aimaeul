import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

/** 한국 시간 기준 YYYY-MM-DD. UTC로 자르면 하루가 밀린다. */
function toKstDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/**
 * 활동 기록이 있는 날짜 목록.
 *
 * 타임라인에서 빈 날짜를 하나씩 넘기게 하면 어르신은 기록을 찾다 지친다.
 * 기록이 있는 날만 오갈 수 있도록 날짜 목록을 내려준다.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ communityId: string }> }
) {
  const { communityId } = await params

  const commSnap = await adminDb.collection('communities').doc(communityId).get()
  if (!commSnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!commSnap.data()!.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  const commRef = adminDb.collection('communities').doc(communityId)
  const [msgSnap, photoSnap, eventSnap] = await Promise.all([
    commRef.collection('messages').orderBy('createdAt', 'desc').limit(1000).get(),
    commRef.collection('photos').orderBy('createdAt', 'desc').limit(1000).get(),
    adminDb
      .collection('events')
      .where('communityId', '==', communityId)
      .orderBy('startAt', 'desc')
      .limit(300)
      .get()
      .catch(() => null),
  ])

  const dates = new Set<string>()

  for (const d of msgSnap.docs) {
    const m = d.data()
    // 시스템 메시지만 있는 날은 "활동"으로 보지 않는다.
    if (m.type === 'system') continue
    const t = m.createdAt?.toDate?.()
    if (t) dates.add(toKstDateString(t))
  }
  for (const d of photoSnap.docs) {
    const t = d.data().createdAt?.toDate?.()
    if (t) dates.add(toKstDateString(t))
  }
  for (const d of eventSnap?.docs ?? []) {
    const t = d.data().startAt?.toDate?.()
    if (t) dates.add(toKstDateString(t))
  }

  // 타임라인은 지나간 기록을 보는 곳이라 아직 오지 않은 날짜(예정 행사)는 뺀다.
  const today = toKstDateString(new Date())
  const sorted = [...dates].filter((d) => d <= today).sort((a, b) => (a < b ? 1 : -1))

  return NextResponse.json({ dates: sorted })
}
