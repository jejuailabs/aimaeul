import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { adminDb } from '@/lib/firebase-admin'
import { generateDailyDigest } from '@/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min for processing all communities

export async function GET(req: Request) {
  // 인증 실패 시 막는다(fail closed).
  //
  // 예전에는 CRON_SECRET이 없으면 검사를 통째로 건너뛰어, 누구나 이 주소를
  // 반복 호출해 Claude API 비용을 발생시킬 수 있었다.
  const authError = verifyCronRequest(req)
  if (authError) return authError

  // Use yesterday's date as the target
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const targetDate = yesterday.toISOString().slice(0, 10)

  // Fetch all communities
  const communitiesSnap = await adminDb.collection('communities').get()
  const results: { communityId: string; ok: boolean; error?: string }[] = []

  for (const doc of communitiesSnap.docs) {
    try {
      await generateDailyDigest(doc.id, doc.data(), targetDate)
      results.push({ communityId: doc.id, ok: true })
    } catch (e: any) {
      console.error(`[cron/daily-digest] Failed for ${doc.id}:`, e)
      results.push({ communityId: doc.id, ok: false, error: e.message })
    }
  }

  return NextResponse.json({
    ok: true,
    date: targetDate,
    processed: results.length,
    results,
  })
}
